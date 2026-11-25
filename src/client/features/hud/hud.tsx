// The always-visible HUD, laid out exactly like the developer's reference picture:
//   top centre: money and bag capsules side by side;
//   left edge, vertically centred: a column of square stat tiles (hover or tap a tile for its full text);
//   right edge, vertically centred: the coloured dock of menu buttons;
//   bottom centre: the goal (goals feature).
// Other features plug in their own stats and buttons, so the HUD knows nothing about factories or chests.
import React, { useEffect, useState } from "@rbxts/react";
import { UserInputService } from "@rbxts/services";
import { bagCapacity, bagTotal } from "shared/features/bag";
import { PlayerView } from "shared/features/profile";
import { useView } from "client/features/profile";
import {
	ButtonVariant,
	COLORS,
	CapsuleBadge,
	CurrencyLabel,
	DEPTH,
	FONTS,
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
	readonly label: string;
	readonly onClick: () => void;
	readonly variant: ButtonVariant;
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
	label: string,
	onClick: () => void,
	order = 50,
	variant: ButtonVariant = "secondary",
): void {
	buttons.push({ order, icon, label, onClick, variant });
	buttons.sort((a, b) => a.order < b.order);
}

// ---------------------------------------------------------------- top centre: money and bag

const MONEY_WIDTH = 260;
const BAG_WIDTH = 340;
const CAPSULE_HEIGHT = 56;
/** Room on the left of a capsule for the badge that sticks out of it. */
const BADGE_ROOM = 58;

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
		<Capsule order={1} width={MONEY_WIDTH}>
			<CapsuleBadge icon="$" ramp={RAMPS.coin} size={62} round={true} rotation={-6} />
			<frame
				BackgroundTransparency={1}
				Position={new UDim2(0, BADGE_ROOM, 0, 4)}
				Size={new UDim2(1, -(BADGE_ROOM + 16), 1, -8)}
			>
				<uilistlayout
					SortOrder={Enum.SortOrder.LayoutOrder}
					VerticalAlignment={Enum.VerticalAlignment.Center}
				/>
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(1, 0, 0, 14)}
					Font={FONTS.display}
					Text="БАЛАНС"
					TextSize={13}
					TextColor3={COLORS.textMuted}
					TextXAlignment={Enum.TextXAlignment.Left}
					LayoutOrder={1}
				/>
				<CurrencyLabel value={props.money} size={30} order={2} />
			</frame>
		</Capsule>
	);
}

function BagCapsule(props: { used: number; capacity: number }) {
	const full = props.used >= props.capacity;
	return (
		<Capsule order={2} width={BAG_WIDTH}>
			<CapsuleBadge icon="🎒" ramp={RAMPS.close} size={58} rotation={3} />
			<frame
				AnchorPoint={new Vector2(0, 0.5)}
				BackgroundTransparency={1}
				Position={new UDim2(0, BADGE_ROOM, 0.5, 0)}
				Size={new UDim2(1, -(BADGE_ROOM + 12), 0, 30)}
			>
				<ProgressBar
					progress={props.capacity > 0 ? props.used / props.capacity : 0}
					color={full ? COLORS.canyon : Color3.fromRGB(251, 191, 36)}
					height={30}
					text={full ? "ПОВНА!" : `${props.used} / ${props.capacity}`}
				/>
			</frame>
		</Capsule>
	);
}

function TopCentre(props: { view: PlayerView }) {
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, 12)}
			Size={new UDim2(0, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.XY}
			BackgroundTransparency={1}
		>
			{/* The gap leaves room for the bag badge that sticks out to the left of its capsule. */}
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				Padding={new UDim(0, 30)}
				SortOrder={Enum.SortOrder.LayoutOrder}
				VerticalAlignment={Enum.VerticalAlignment.Top}
			/>
			<MoneyCapsule money={props.view.money} />
			<BagCapsule used={bagTotal(props.view.bag)} capacity={bagCapacity(props.view.gear.equipped.bag)} />
		</frame>
	);
}

// ---------------------------------------------------------------- right: dock

/**
 * On touch screens Roblox puts the jump button in the bottom-right corner. A dock centred on the right edge reaches into
 * it on a phone in landscape, so there the dock sits higher.
 */
const PHONE_DOCK_CENTRE = 0.38;

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

function Dock() {
	const touch = useTouchFirst();
	return (
		<frame
			AnchorPoint={new Vector2(1, 0.5)}
			Position={new UDim2(1, -18, touch ? PHONE_DOCK_CENTRE : 0.5, 0)}
			Size={new UDim2(0, MENU_BUTTON_SIZE, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundTransparency={1}
		>
			<uilistlayout Padding={new UDim(0, 10)} SortOrder={Enum.SortOrder.LayoutOrder} />
			{buttons.map((button, index) => (
				<MenuButton
					key={`menu_${index}`}
					icon={button.icon}
					label={button.label}
					onClick={button.onClick}
					variant={button.variant}
					order={index}
				/>
			))}
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
			Position={new UDim2(0, 18, 0, 12)}
			Size={new UDim2(0, STAT_TILE_SIZE * 2 + TILE_GAP, 1, -24)}
			BackgroundTransparency={1}
		>
			{/* One column centred on the left edge, like the reference. The frame spans the screen height, so the grid
			    fills it top to bottom and starts a second column by itself only when a short screen (a phone in
			    landscape) has no room for all tiles. */}
			<uigridlayout
				CellSize={new UDim2(0, STAT_TILE_SIZE, 0, STAT_TILE_SIZE + DEPTH.button)}
				CellPadding={new UDim2(0, TILE_GAP, 0, 8)}
				FillDirection={Enum.FillDirection.Vertical}
				VerticalAlignment={Enum.VerticalAlignment.Center}
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
			<TopCentre view={view} />
			<StatGrid view={view} />
			<Dock />
		</>
	);
}
