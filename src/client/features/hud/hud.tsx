// The always-visible HUD, laid out so the centre of the screen stays free for the game:
//   top right: money and bag capsules, below them the coloured dock of menu buttons;
//   top left: square stat tiles (hover or tap a tile for its full text).
// Other features plug in their own stats and buttons, so the HUD knows nothing about factories or chests.
import React from "@rbxts/react";
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

// ---------------------------------------------------------------- top right: money and bag

const CAPSULE_WIDTH = 270;
const CAPSULE_HEIGHT = 56;
/** Room on the left of a capsule for the badge that sticks out of it. */
const BADGE_ROOM = 58;

function Capsule(props: React.PropsWithChildren<{ order: number }>) {
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(0, CAPSULE_WIDTH, 0, CAPSULE_HEIGHT + DEPTH.button)}
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
		<Capsule order={1}>
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
		<Capsule order={2}>
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

function TopRight(props: { view: PlayerView }) {
	return (
		<frame
			AnchorPoint={new Vector2(1, 0)}
			Position={new UDim2(1, -18, 0, 12)}
			Size={new UDim2(0, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.XY}
			BackgroundTransparency={1}
		>
			<uilistlayout
				Padding={new UDim(0, 10)}
				SortOrder={Enum.SortOrder.LayoutOrder}
				HorizontalAlignment={Enum.HorizontalAlignment.Right}
			/>
			<MoneyCapsule money={props.view.money} />
			<BagCapsule used={bagTotal(props.view.bag)} capacity={bagCapacity(props.view.levels.bag)} />
		</frame>
	);
}

// ---------------------------------------------------------------- right: dock

/** The dock starts below the two capsules. */
const DOCK_TOP = 12 + 2 * (CAPSULE_HEIGHT + DEPTH.button) + 10 + 26;

function Dock() {
	return (
		<frame
			AnchorPoint={new Vector2(1, 0)}
			Position={new UDim2(1, -18, 0, DOCK_TOP)}
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

// ---------------------------------------------------------------- top left: stat tiles

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
			Size={new UDim2(0, STAT_TILE_SIZE * 2 + 12, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundTransparency={1}
		>
			<uigridlayout
				CellSize={new UDim2(0, STAT_TILE_SIZE, 0, STAT_TILE_SIZE + DEPTH.button)}
				CellPadding={new UDim2(0, 12, 0, 10)}
				FillDirectionMaxCells={2}
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
			<TopRight view={view} />
			<StatGrid view={view} />
			<Dock />
		</>
	);
}
