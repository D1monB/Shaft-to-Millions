// The always-visible HUD: money and bag at the top, short stats on the left, menu buttons on the left edge.
// Other features plug in their own stats and buttons, so the HUD knows nothing about factories or chests.
import React from "@rbxts/react";
import { bagCapacity, bagTotal } from "shared/features/bag";
import { PlayerView } from "shared/features/profile";
import { formatCount } from "shared/lib/format";
import { useView } from "client/features/profile";
import { COLORS, CurrencyLabel, MenuButton, ProgressBar, RADIUS, STROKE, StatChip, Tone } from "client/lib/ui-kit";

export interface HudStat {
	readonly icon: string;
	readonly text: string;
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
}

const stats: StatEntry[] = [];
const buttons: ButtonEntry[] = [];

/**
 * Adds a stat chip to the left column. `render` returns undefined to hide it. Lower `order` is higher.
 * Register before the UI mounts (in a feature's start function).
 */
export function registerHudStat(order: number, render: (view: PlayerView) => HudStat | undefined): void {
	stats.push({ order, render });
	stats.sort((a, b) => a.order < b.order);
}

/** Adds a square button to the menu on the left edge (e.g. Equipment). */
export function registerHudButton(icon: string, label: string, onClick: () => void, order = 50): void {
	buttons.push({ order, icon, label, onClick });
	buttons.sort((a, b) => a.order < b.order);
}

function TopBar(props: { view: PlayerView }) {
	const used = bagTotal(props.view.bag);
	const capacity = bagCapacity(props.view.levels.bag);
	const full = used >= capacity;
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, 10)}
			Size={new UDim2(0, 300, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundColor3={COLORS.woodDark}
			BackgroundTransparency={0.05}
		>
			<uicorner CornerRadius={RADIUS.large} />
			<uistroke Color={COLORS.outline} Thickness={STROKE.heavy} />
			<uipadding
				PaddingTop={new UDim(0, 4)}
				PaddingBottom={new UDim(0, 10)}
				PaddingLeft={new UDim(0, 14)}
				PaddingRight={new UDim(0, 14)}
			/>
			<uilistlayout Padding={new UDim(0, 2)} SortOrder={Enum.SortOrder.LayoutOrder} />
			<CurrencyLabel value={props.view.money} size={34} align={Enum.TextXAlignment.Center} order={1} />
			<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 22)} LayoutOrder={2}>
				<textlabel BackgroundTransparency={1} Size={new UDim2(0, 26, 1, 0)} Text="🎒" TextSize={18} />
				<frame BackgroundTransparency={1} Position={new UDim2(0, 30, 0, 2)} Size={new UDim2(1, -30, 1, -4)}>
					<ProgressBar
						progress={capacity > 0 ? used / capacity : 0}
						color={full ? COLORS.canyon : COLORS.crystal}
						height={18}
						text={full ? `${formatCount(used, capacity)}  ПОВНА!` : formatCount(used, capacity)}
					/>
				</frame>
			</frame>
		</frame>
	);
}

function StatColumn(props: { view: PlayerView }) {
	const chips: React.Element[] = [];
	stats.forEach((entry, index) => {
		const stat = entry.render(props.view);
		if (stat !== undefined) {
			chips.push(
				<StatChip key={`stat_${index}`} icon={stat.icon} text={stat.text} tone={stat.tone} order={index} />,
			);
		}
	});
	return (
		<frame
			Position={new UDim2(0, 12, 0, 70)}
			Size={new UDim2(0, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.XY}
			BackgroundTransparency={1}
		>
			<uilistlayout Padding={new UDim(0, 6)} SortOrder={Enum.SortOrder.LayoutOrder} />
			{chips}
		</frame>
	);
}

function MenuColumn() {
	return (
		<frame
			AnchorPoint={new Vector2(0, 0.5)}
			Position={new UDim2(0, 12, 0.62, 0)}
			Size={new UDim2(0, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.XY}
			BackgroundTransparency={1}
		>
			<uilistlayout Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} />
			{buttons.map((button, index) => (
				<MenuButton
					key={`menu_${index}`}
					icon={button.icon}
					label={button.label}
					onClick={button.onClick}
					order={index}
				/>
			))}
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
			<TopBar view={view} />
			<StatColumn view={view} />
			<MenuColumn />
		</>
	);
}
