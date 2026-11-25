// Shop panel: a catalogue. One tab per gear track, every level of the track is its own card
// (bought and replaced, in use, for sale, locked). Buying sends only the intent (track + the level the player saw);
// the server checks money and distance.
import React, { useState } from "@rbxts/react";
import { BAGS } from "shared/config/bags";
import { Rarity } from "shared/config/items";
import { TAGS } from "shared/config/map-contract";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import {
	BUY_UPGRADE_REMOTE,
	LevelState,
	UPGRADE_TRACKS,
	UpgradeTrack,
	isUpgradeTrack,
	levelState,
} from "shared/features/upgrades";
import { useView } from "client/features/profile";
import { ITEM_CARD_FOOTER, ITEM_CARD_HEIGHT, RarityCard } from "client/lib/item-card";
import { RARITY_LIGHT, RARITY_RAMPS } from "client/lib/item-display";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import { BuyButton, COLORS, Card, FONTS, Label, TEXT_SIZES, Tabs } from "client/lib/ui-kit";

const TABS: ReadonlyArray<{ readonly key: UpgradeTrack; readonly label: string; readonly icon: string }> = [
	{ key: "pickaxe", label: "⛏ Кирки", icon: "⛏" },
	{ key: "bag", label: "🎒 Сумки", icon: "🎒" },
	{ key: "shoes", label: "👟 Взуття", icon: "👟" },
];

/** Card colours climb the rarity ramp with the level, so the best gear looks the best. */
const COLOUR_STEPS: ReadonlyArray<Rarity> = ["common", "uncommon", "rare", "epic", "legendary"];

function colourOf(level: number, levels: number): Rarity {
	const step = math.floor(((level - 1) * COLOUR_STEPS.size()) / levels);
	return COLOUR_STEPS[math.clamp(step, 0, COLOUR_STEPS.size() - 1)];
}

function describe(track: UpgradeTrack, level: number): string {
	if (track === "pickaxe") {
		const pickaxe = PICKAXES[level - 1];
		return `Руда до рівня ${pickaxe.tier} · удар ${pickaxe.power}`;
	}
	if (track === "bag") {
		return `Місткість ${BAGS[level - 1].capacity} шт.`;
	}
	return `Швидкість ${SHOES[level - 1].walkSpeed} (звичайна 16)`;
}

/** Ores the pickaxe of `level` opens compared with the level before it: the clearest reason to buy it. */
function unlockedBy(level: number): string {
	const before = PICKAXES[level - 2];
	const upcoming = PICKAXES[level - 1];
	if (before === undefined || upcoming === undefined) {
		return "";
	}
	return ORE_IDS.filter((id) => ORES[id].requiredTier > before.tier && ORES[id].requiredTier <= upcoming.tier)
		.map((id) => ORES[id].name)
		.join(", ");
}

/** A line of text in the card footer, where a buy button would be. */
function FooterNote(props: { text: string; color: Color3 }) {
	return (
		<textlabel
			BackgroundTransparency={1}
			Size={UDim2.fromScale(1, 1)}
			Font={FONTS.display}
			Text={props.text}
			TextColor3={props.color}
			TextSize={TEXT_SIZES.small}
			TextWrapped={true}
			ZIndex={8}
		>
			<uistroke Color={COLORS.outline} Thickness={1.5} />
		</textlabel>
	);
}

function footerOf(state: LevelState, props: GearCardProps): React.Element {
	if (state === "next") {
		return (
			<BuyButton
				price={UPGRADE_TRACKS[props.track][props.level - 1].price}
				money={props.money}
				verb="Купити"
				textSize={TEXT_SIZES.small}
				onClick={() => sendToServer(BUY_UPGRADE_REMOTE, props.track, props.current)}
			/>
		);
	}
	if (state === "current") {
		return <FooterNote text="Зараз у тебе" color={COLORS.success} />;
	}
	if (state === "replaced") {
		return <FooterNote text="Є краща" color={COLORS.textMuted} />;
	}
	const previous = UPGRADE_TRACKS[props.track][props.level - 2];
	return <FooterNote text={`🔒 Спершу: ${previous.name}`} color={COLORS.textMuted} />;
}

interface GearCardProps {
	readonly track: UpgradeTrack;
	readonly icon: string;
	readonly level: number;
	readonly current: number;
	readonly money: number;
}

function GearCard(props: GearCardProps) {
	const levels = UPGRADE_TRACKS[props.track];
	const def = levels[props.level - 1];
	const state = levelState(props.level, props.current);
	const colour = colourOf(props.level, levels.size());
	return (
		<RarityCard
			ramp={RARITY_RAMPS[colour]}
			light={RARITY_LIGHT[colour]}
			icon={props.icon}
			name={def.name}
			pill={`РІВЕНЬ ${props.level}`}
			effect={describe(props.track, props.level)}
			rays={props.level === levels.size()}
			dimmed={state === "replaced" || state === "locked"}
			highlighted={state === "current"}
			topLeft={
				state === "current"
					? { text: "✔ НАДІТО", color: COLORS.success }
					: state === "replaced"
						? { text: "КУПЛЕНО", color: COLORS.textMuted }
						: undefined
			}
			footer={footerOf(state, props)}
			order={props.level}
		/>
	);
}

/** One line over the grid: what the player has and what the next level gives. */
function hintOf(track: UpgradeTrack, current: number): string {
	const levels = UPGRADE_TRACKS[track];
	const now = `Зараз: ${levels[current - 1].name} (рівень ${current}/${levels.size()}).`;
	if (current >= levels.size()) {
		return `${now} ✨ Найкраща вже твоя!`;
	}
	const unlocks = track === "pickaxe" ? unlockedBy(current + 1) : "";
	return unlocks !== "" ? `${now} Наступна відкриває: ${unlocks}` : now;
}

function ShopPanel() {
	const view = useView();
	const [tab, setTab] = useState<UpgradeTrack>("pickaxe");
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	const current = view.levels[tab];
	const icon = TABS.find((entry) => entry.key === tab)?.icon ?? "";
	const levels = UPGRADE_TRACKS[tab];
	return (
		<>
			<Tabs
				items={TABS.map((entry) => ({ key: entry.key, label: entry.label }))}
				selected={tab}
				onSelect={(key) => {
					if (isUpgradeTrack(key)) {
						setTab(key);
					}
				}}
				order={1}
			/>
			<Label text={hintOf(tab, current)} tone="muted" size={TEXT_SIZES.small + 1} order={2} />
			<Card order={3}>
				<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 0)} AutomaticSize={Enum.AutomaticSize.Y}>
					<uigridlayout
						CellSize={new UDim2(1 / 3, -8, 0, ITEM_CARD_HEIGHT + ITEM_CARD_FOOTER)}
						CellPadding={new UDim2(0, 12, 0, 14)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{levels.map((_, index) => (
						<GearCard
							key={`${tab}_${index + 1}`}
							track={tab}
							icon={icon}
							level={index + 1}
							current={current}
							money={view.money}
						/>
					))}
				</frame>
			</Card>
		</>
	);
}

export function startShopController(): void {
	onPromptForTag(TAGS.Shop, () =>
		openPanel({ key: "shop", title: "Магазин спорядження", icon: "🛒", render: () => <ShopPanel /> }),
	);
}
