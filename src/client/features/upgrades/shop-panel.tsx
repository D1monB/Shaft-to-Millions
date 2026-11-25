// Shop panel: a catalogue. One tab per slot (pickaxes, bags, shoes), one card per item. Everything is for sale
// at once: an item costs money plus materials from the warehouse, is kept forever and can be equipped any time.
// Buying and equipping send only the item id; the server checks distance, money, materials and ownership.
import React, { useState } from "@rbxts/react";
import { BAGS } from "shared/config/bags";
import { GearBase } from "shared/config/gear";
import { Rarity } from "shared/config/items";
import { TAGS } from "shared/config/map-contract";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import {
	BUY_GEAR_REMOTE,
	EQUIP_GEAR_REMOTE,
	GEAR_BY_SLOT,
	GearSlot,
	gearCardState,
	isGearSlot,
	materialList,
	missingMaterials,
} from "shared/features/upgrades";
import { PlayerView } from "shared/features/profile";
import { formatPercent } from "shared/lib/format";
import { useView } from "client/features/profile";
import { ITEM_CARD_HEIGHT, RarityCard } from "client/lib/item-card";
import { ResourceTile } from "client/lib/resource-tile";
import { RARITY_LIGHT, RARITY_RAMPS } from "client/lib/item-display";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import { BuyButton, Button, COLORS, Card, FONTS, Label, TEXT_SIZES, Tabs } from "client/lib/ui-kit";

const TABS: ReadonlyArray<{ readonly key: GearSlot; readonly label: string; readonly icon: string }> = [
	{ key: "pickaxe", label: "⛏️ Кирки", icon: "⛏️" },
	{ key: "bag", label: "🎒 Сумки", icon: "🎒" },
	{ key: "shoes", label: "👟 Взуття", icon: "👟" },
];

/** Footer: a row of material tiles (with "have/need" under each) above the button. */
const MATERIAL_TILE = 30;
const MATERIALS_ROW = MATERIAL_TILE + 24;
const FOOTER_HEIGHT = MATERIALS_ROW + 64;
const BASE_WALK_SPEED = 16;

/** Card colours climb the rarity ramp along the catalogue, so the best gear looks the best. */
const COLOUR_STEPS: ReadonlyArray<Rarity> = ["common", "uncommon", "rare", "epic", "legendary"];

function colourOf(index: number, count: number): Rarity {
	const step = math.floor((index * COLOUR_STEPS.size()) / count);
	return COLOUR_STEPS[math.clamp(step, 0, COLOUR_STEPS.size() - 1)];
}

/** The middle pill and the effect line of a card. */
function statsOf(slot: GearSlot, index: number): { pill: string; effect: string } {
	if (slot === "pickaxe") {
		const def = PICKAXES[index];
		const stats = `Удар ${def.power} · раз на ${def.swingSeconds} с`;
		return { pill: `РУДА ДО РІВНЯ ${def.tier}`, effect: def.special !== undefined ? def.special : stats };
	}
	if (slot === "bag") {
		const def = BAGS[index];
		return { pill: `МІСТКІСТЬ ${def.capacity}`, effect: `Носиш до ${def.capacity} шматків руди` };
	}
	const def = SHOES[index];
	const faster = def.walkSpeed / BASE_WALK_SPEED - 1;
	return {
		pill: `ШВИДКІСТЬ ${def.walkSpeed}`,
		effect: faster > 0 ? `Бігаєш на ${formatPercent(faster)} швидше` : "Звичайна швидкість",
	};
}

/** A line of text in the card footer, where a button would be. */
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

/** The button area at the bottom of the footer, so buttons line up across cards. */
function ButtonSlot(props: React.PropsWithChildren) {
	return (
		<frame
			BackgroundTransparency={1}
			Position={new UDim2(0, 0, 0, MATERIALS_ROW)}
			Size={new UDim2(1, 0, 1, -MATERIALS_ROW)}
		>
			{props.children}
		</frame>
	);
}

/** Each material as a small tile; "have/need" under it is green when there is enough, red when not. */
function MaterialTiles(props: { def: GearBase; view: PlayerView }) {
	const list = materialList(props.def.materials);
	if (list.size() === 0) {
		return (
			<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, MATERIALS_ROW)}>
				<FooterNote text="Лише гроші" color={COLORS.textMuted} />
			</frame>
		);
	}
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, MATERIALS_ROW)}>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 14)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{list.map((entry, index) => {
				const have = props.view.warehouse[entry.id] ?? 0;
				return (
					<ResourceTile
						key={entry.id}
						id={entry.id}
						size={MATERIAL_TILE}
						caption={`${math.min(have, entry.amount)}/${entry.amount}`}
						captionColor={have >= entry.amount ? COLORS.success : COLORS.danger}
						order={index}
					/>
				);
			})}
		</frame>
	);
}

function ForSaleFooter(props: { def: GearBase; view: PlayerView }) {
	const enough = missingMaterials(props.def, props.view.warehouse).size() === 0;
	return (
		<>
			<MaterialTiles def={props.def} view={props.view} />
			<ButtonSlot>
				<BuyButton
					price={props.def.price}
					money={props.view.money}
					verb="Купити"
					blocked={!enough}
					textSize={TEXT_SIZES.small}
					onClick={() => sendToServer(BUY_GEAR_REMOTE, props.def.id)}
				/>
			</ButtonSlot>
		</>
	);
}

function footerOf(def: GearBase, view: PlayerView): React.Element {
	const state = gearCardState(def.id, view.gear);
	if (state === "equipped") {
		return <FooterNote text="Зараз у тебе" color={COLORS.success} />;
	}
	if (state === "owned") {
		return (
			<ButtonSlot>
				<Button
					text="Надіти"
					variant="success"
					textSize={TEXT_SIZES.small + 2}
					onClick={() => sendToServer(EQUIP_GEAR_REMOTE, def.id)}
				/>
			</ButtonSlot>
		);
	}
	return <ForSaleFooter def={def} view={view} />;
}

function GearCard(props: { slot: GearSlot; icon: string; index: number; view: PlayerView }) {
	const items = GEAR_BY_SLOT[props.slot];
	const def = items[props.index];
	const state = gearCardState(def.id, props.view.gear);
	const colour = colourOf(props.index, items.size());
	const stats = statsOf(props.slot, props.index);
	return (
		<RarityCard
			ramp={RARITY_RAMPS[colour]}
			light={RARITY_LIGHT[colour]}
			icon={props.icon}
			name={def.name}
			pill={stats.pill}
			effect={stats.effect}
			rays={props.index === items.size() - 1}
			highlighted={state === "equipped"}
			topLeft={
				state === "equipped"
					? { text: "✅ НАДІТО", color: COLORS.success }
					: state === "owned"
						? { text: "КУПЛЕНО", color: COLORS.textMuted }
						: undefined
			}
			topRight={def.special !== undefined ? { text: "⚡", color: COLORS.gold } : undefined}
			footer={footerOf(def, props.view)}
			footerHeight={FOOTER_HEIGHT}
			order={props.index}
		/>
	);
}

function ShopPanel() {
	const view = useView();
	const [tab, setTab] = useState<GearSlot>("pickaxe");
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	const items = GEAR_BY_SLOT[tab];
	const icon = TABS.find((entry) => entry.key === tab)?.icon ?? "";
	const equipped = items.find((def) => def.id === view.gear.equipped[tab]) ?? items[0];
	const owned = items.filter((def) => view.gear.owned.includes(def.id)).size();
	return (
		<>
			<Tabs
				items={TABS.map((entry) => ({ key: entry.key, label: entry.label }))}
				selected={tab}
				onSelect={(key) => {
					if (isGearSlot(key)) {
						setTab(key);
					}
				}}
				order={1}
			/>
			<Label
				text={`Надіто: ${equipped.name}. Куплено ${owned} з ${items.size()}. Матеріали беруться зі складу.`}
				tone="muted"
				size={TEXT_SIZES.small + 1}
				order={2}
			/>
			<Card order={3}>
				<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 0)} AutomaticSize={Enum.AutomaticSize.Y}>
					<uigridlayout
						CellSize={new UDim2(1 / 3, -8, 0, ITEM_CARD_HEIGHT + FOOTER_HEIGHT)}
						CellPadding={new UDim2(0, 12, 0, 14)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{items.map((def, index) => (
						<GearCard key={def.id} slot={tab} icon={icon} index={index} view={view} />
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
