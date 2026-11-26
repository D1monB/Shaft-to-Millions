// The always-visible HUD (layout changed after the developer's feedback 2026-11-26: the big capsules at the top centre
// were in the way):
//   top left, under Roblox's own buttons: small money, crystal and bag capsules, one above the other;
//   left edge, below them: a column of square stat tiles (hover or tap a tile for its full text);
//   right edge, vertically centred: the coloured dock of menu buttons;
//   top centre: the goal (goals feature); bottom centre: the pickaxe hotbar (upgrades feature).
// Other features plug in their own stats and buttons, so the HUD knows nothing about factories or chests.
import { t } from "client/lib/i18n";
import React, { useEffect, useState } from "@rbxts/react";
import { UserInputService } from "@rbxts/services";
import { bagCapacity, bagTotal } from "shared/features/bag";
import { baseEffects } from "shared/features/base";
import { PlayerView } from "shared/features/profile";
import { useView } from "client/features/profile";
import { closePanel, openPanel } from "client/lib/panels";
import {
	Button,
	ButtonVariant,
	COLORS,
	CapsuleBadge,
	CurrencyLabel,
	DEPTH,
	MENU_BUTTON_SIZE,
	MenuButton,
	ProgressBar,
	RADIUS,
	RAMPS,
	STAT_TILE_SIZE,
	STROKE,
	StatTile,
	Tone,
	rampSequence,
} from "client/lib/ui-kit";

export interface HudStat {
	readonly icon: string;
	/** Full text, shown when the player hovers or taps the tile. */
	readonly text: string;
	/** Short value shown on the tile itself (a number or a fraction). Falls back to `text`. */
	readonly short?: string;
	readonly tone?: Tone;
}

interface StatEntry {
	readonly order: number;
	readonly render: (view: PlayerView) => HudStat | undefined;
}

interface ButtonEntry {
	readonly order: number;
	readonly icon: string;
	/** A function when the label depends on the language (called on every render). */
	readonly label: string | (() => string);
	readonly onClick: () => void;
	readonly variant: ButtonVariant;
	/** Shown in the "more" menu instead of the dock, to keep a phone screen clear. */
	readonly secondary: boolean;
}

const stats: StatEntry[] = [];
const buttons: ButtonEntry[] = [];

/**
 * Adds a stat tile. `render` returns undefined to hide it. Lower `order` comes first.
 * Register before the UI mounts (in a feature's start function).
 */
export function registerHudStat(order: number, render: (view: PlayerView) => HudStat | undefined): void {
	stats.push({ order, render });
	stats.sort((a, b) => a.order < b.order);
}

/** Adds a square button to the dock on the right edge (e.g. Equipment). `variant` picks its colour. */
export function registerHudButton(
	icon: string,
	label: string | (() => string),
	onClick: () => void,
	order = 50,
	variant: ButtonVariant = "secondary",
	secondary = false,
): void {
	buttons.push({ order, icon, label, onClick, variant, secondary });
	buttons.sort((a, b) => a.order < b.order);
}

// ---------------------------------------------------------------- top left: money and bag

const CAPSULE_WIDTH = 180;
const CAPSULE_HEIGHT = 34;
const CAPSULE_GAP = 8;
/** Room on the left of a capsule for the badge that sticks out of it. */
const BADGE_ROOM = 40;
/** Below Roblox's own top bar buttons (menu, chat), which take the top-left corner. */
const TOP_LEFT_Y = 60;
/** Where the stat tiles start: under both capsules. */
const STATS_Y = TOP_LEFT_Y + 3 * (CAPSULE_HEIGHT + DEPTH.button + CAPSULE_GAP) + 4;

function Capsule(props: React.PropsWithChildren<{ order: number; width: number }>) {
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(0, props.width, 0, CAPSULE_HEIGHT + DEPTH.button)}
			LayoutOrder={props.order}
		>
			<frame
				BackgroundColor3={COLORS.outline}
				BorderSizePixel={0}
				Position={new UDim2(0, 0, 0, DEPTH.button)}
				Size={new UDim2(1, 0, 0, CAPSULE_HEIGHT)}
			>
				<uicorner CornerRadius={RADIUS.round} />
			</frame>
			<frame BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={new UDim2(1, 0, 0, CAPSULE_HEIGHT)}>
				<uicorner CornerRadius={RADIUS.round} />
				<uistroke Color={COLORS.outline} Thickness={STROKE.thick} />
				<uigradient Rotation={90} Color={rampSequence(RAMPS.capsule)} />
				{props.children}
			</frame>
		</frame>
	);
}

function MoneyCapsule(props: { money: number }) {
	return (
		<Capsule order={1} width={CAPSULE_WIDTH}>
			<CapsuleBadge icon="$" ramp={RAMPS.coin} size={38} round={true} rotation={-6} />
			<frame
				AnchorPoint={new Vector2(0, 0.5)}
				BackgroundTransparency={1}
				Position={new UDim2(0, BADGE_ROOM, 0.5, 0)}
				Size={new UDim2(1, -(BADGE_ROOM + 12), 1, -6)}
			>
				<uilistlayout
					SortOrder={Enum.SortOrder.LayoutOrder}
					VerticalAlignment={Enum.VerticalAlignment.Center}
				/>
				<CurrencyLabel value={props.money} size={20} order={1} />
			</frame>
		</Capsule>
	);
}

function CrystalCapsule(props: { crystals: number }) {
	return (
		<Capsule order={2} width={CAPSULE_WIDTH}>
			<CapsuleBadge icon="💎" ramp={RAMPS.gem} size={36} round={true} rotation={4} />
			<frame
				AnchorPoint={new Vector2(0, 0.5)}
				BackgroundTransparency={1}
				Position={new UDim2(0, BADGE_ROOM, 0.5, 0)}
				Size={new UDim2(1, -(BADGE_ROOM + 12), 1, -6)}
			>
				<uilistlayout
					SortOrder={Enum.SortOrder.LayoutOrder}
					VerticalAlignment={Enum.VerticalAlignment.Center}
				/>
				<CurrencyLabel value={props.crystals} size={20} color={COLORS.crystal} plain={true} order={1} />
			</frame>
		</Capsule>
	);
}

function BagCapsule(props: { used: number; capacity: number }) {
	const full = props.used >= props.capacity;
	return (
		<Capsule order={3} width={CAPSULE_WIDTH}>
			<CapsuleBadge icon="🎒" ramp={RAMPS.close} size={36} rotation={3} />
			<frame
				AnchorPoint={new Vector2(0, 0.5)}
				BackgroundTransparency={1}
				Position={new UDim2(0, BADGE_ROOM, 0.5, 0)}
				Size={new UDim2(1, -(BADGE_ROOM + 10), 0, 22)}
			>
				<ProgressBar
					progress={props.capacity > 0 ? props.used / props.capacity : 0}
					color={full ? COLORS.canyon : Color3.fromRGB(251, 191, 36)}
					height={22}
					text={full ? t("hud.bagFull") : `${props.used} / ${props.capacity}`}
				/>
			</frame>
		</Capsule>
	);
}

function TopLeft(props: { view: PlayerView }) {
	return (
		<frame
			Position={new UDim2(0, 18, 0, TOP_LEFT_Y)}
			Size={new UDim2(0, CAPSULE_WIDTH, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundTransparency={1}
		>
			<uilistlayout Padding={new UDim(0, CAPSULE_GAP)} SortOrder={Enum.SortOrder.LayoutOrder} />
			<MoneyCapsule money={props.view.money} />
			<CrystalCapsule crystals={props.view.crystals} />
			<BagCapsule
				used={bagTotal(props.view.bag)}
				capacity={bagCapacity(props.view.gear.equipped.bag, baseEffects(props.view.base).bagBonus)}
			/>
		</frame>
	);
}

// ---------------------------------------------------------------- right: dock

/**
 * On touch screens Roblox puts the jump button in the bottom-right corner. A dock centred on the right edge reaches into
 * it on a phone in landscape, so there the dock sits higher.
 */
const PHONE_DOCK_CENTRE = 0.38;

/** Dock buttons per column and the space between them. */
const DOCK_ROWS = 4;
const DOCK_GAP = 10;

/**
 * True while touch is the player's main input. PreferredInput follows the device actually in use; TouchEnabled only
 * says a touch screen exists (a touch laptop has one too), so it would move the dock for keyboard players.
 */
function useTouchFirst(): boolean {
	const read = () => UserInputService.PreferredInput === Enum.PreferredInput.Touch;
	const [touch, setTouch] = useState(read);
	useEffect(() => {
		const connection = UserInputService.GetPropertyChangedSignal("PreferredInput").Connect(() => setTouch(read()));
		return () => connection.Disconnect();
	}, []);
	return touch;
}

function labelOf(button: ButtonEntry): string {
	return typeIs(button.label, "function") ? button.label() : button.label;
}

/** The secondary buttons as a list of big buttons in a panel. */
function MorePanel() {
	return (
		<>
			{buttons
				.filter((button) => button.secondary)
				.map((button, index) => (
					<Button
						key={`more_${index}`}
						text={`${button.icon}  ${labelOf(button)}`}
						variant={button.variant}
						height={52}
						onClick={() => {
							closePanel();
							button.onClick();
						}}
						order={index}
					/>
				))}
		</>
	);
}

function openMore(): void {
	openPanel({ key: "more", title: t("menu.more"), icon: "⋯", render: () => <MorePanel /> });
}

function Dock() {
	const touch = useTouchFirst();
	return (
		<frame
			AnchorPoint={new Vector2(1, 0.5)}
			Position={new UDim2(1, -18, touch ? PHONE_DOCK_CENTRE : 0.5, 0)}
			Size={
				new UDim2(
					0,
					MENU_BUTTON_SIZE * 2 + DOCK_GAP,
					0,
					DOCK_ROWS * (MENU_BUTTON_SIZE + DEPTH.button + DOCK_GAP),
				)
			}
			BackgroundTransparency={1}
		>
			{/* Two columns: with the base, quests and store the single column no longer fits a phone in landscape. */}
			<uigridlayout
				CellSize={new UDim2(0, MENU_BUTTON_SIZE, 0, MENU_BUTTON_SIZE + DEPTH.button)}
				CellPadding={new UDim2(0, DOCK_GAP, 0, DOCK_GAP)}
				FillDirection={Enum.FillDirection.Vertical}
				FillDirectionMaxCells={DOCK_ROWS}
				HorizontalAlignment={Enum.HorizontalAlignment.Right}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				StartCorner={Enum.StartCorner.TopRight}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{buttons
				.filter((button) => !button.secondary)
				.map((button, index) => (
					<MenuButton
						key={`menu_${index}`}
						icon={button.icon}
						label={labelOf(button)}
						onClick={button.onClick}
						variant={button.variant}
						order={index}
					/>
				))}
			{buttons.some((button) => button.secondary) && (
				<MenuButton icon="⋯" label={t("menu.more")} onClick={openMore} variant="slate" order={99} />
			)}
		</frame>
	);
}

// ---------------------------------------------------------------- left: stat tiles

const TILE_GAP = 12;

function StatGrid(props: { view: PlayerView }) {
	const tiles: React.Element[] = [];
	stats.forEach((entry, index) => {
		const stat = entry.render(props.view);
		if (stat !== undefined) {
			tiles.push(
				<StatTile
					key={`stat_${index}`}
					icon={stat.icon}
					value={stat.short ?? stat.text}
					tooltip={stat.text}
					tone={stat.tone}
					order={index}
				/>,
			);
		}
	});
	return (
		<frame
			Position={new UDim2(0, 18, 0, STATS_Y)}
			Size={new UDim2(0, STAT_TILE_SIZE * 2 + TILE_GAP, 1, -(STATS_Y + 12))}
			BackgroundTransparency={1}
		>
			{/* One column under the capsules. The frame spans the rest of the screen height, so the grid fills it top to
			    bottom and starts a second column by itself only when a short screen (a phone in landscape) has no
			    room for all tiles. */}
			<uigridlayout
				CellSize={new UDim2(0, STAT_TILE_SIZE, 0, STAT_TILE_SIZE + DEPTH.button)}
				CellPadding={new UDim2(0, TILE_GAP, 0, 8)}
				FillDirection={Enum.FillDirection.Vertical}
				VerticalAlignment={Enum.VerticalAlignment.Top}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{tiles}
		</frame>
	);
}

export function Hud() {
	const view = useView();
	if (view === undefined) {
		return undefined;
	}
	return (
		<>
			<TopLeft view={view} />
			<StatGrid view={view} />
			<Dock />
		</>
	);
}
