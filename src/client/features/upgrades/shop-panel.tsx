// Shop panel: a catalogue. One tab per slot (pickaxes, bags, shoes), one card per item. Everything is for sale
// at once: an item costs money only, is kept forever and can be equipped any time.
// Buying and equipping send only the item id; the server checks distance, money and ownership.
import { StringKey } from "shared/config/i18n";
import { nameKeys } from "shared/features/i18n";
import { t } from "client/lib/i18n";
import React, { useState } from "@rbxts/react";
import { BAGS } from "shared/config/bags";
import { GearBase } from "shared/config/gear";
import { Rarity } from "shared/config/items";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import {
	BUY_GEAR_REMOTE,
	EQUIP_GEAR_REMOTE,
	GEAR_BY_SLOT,
	GearSlot,
	gearCardState,
	isGearSlot,
	ShopSlot,
	shopSlotOf,
} from "shared/features/upgrades";
import { PlayerView } from "shared/features/profile";
import { formatPercent } from "shared/lib/format";
import { useView } from "client/features/profile";
import { ITEM_CARD_HEIGHT, ITEM_CARD_WIDTH, RarityCard } from "client/lib/item-card";
import { RARITY_LIGHT, RARITY_RAMPS } from "client/lib/item-display";
import { pickaxeTemplate } from "client/lib/model-icon";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import { hideDefaultBackpack } from "./pickaxe-hotbar";
import { startPickaxeSwing } from "./pickaxe-swing";
import { BuyButton, Button, COLORS, CardStrip, FONTS, Label, StripSlot, TEXT_SIZES, Tabs } from "client/lib/ui-kit";

const TABS: ReadonlyArray<{ readonly key: GearSlot; readonly label: StringKey; readonly icon: string }> = [
	{ key: "pickaxe", label: "shop.tab.pickaxe", icon: "⛏️" },
	{ key: "bag", label: "shop.tab.bag", icon: "🎒" },
	{ key: "shoes", label: "shop.tab.shoes", icon: "👟" },
];

/** Footer: the buy / equip button or a note. */
const FOOTER_HEIGHT = 56;
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
		const stats = t("shop.pickaxeStats", { power: def.power, seconds: def.swingSeconds });
		const effect = def.special !== undefined ? t(nameKeys.gearSpecial(def.id)) : stats;
		return { pill: t("shop.pickaxePill", { tier: def.tier }), effect };
	}
	if (slot === "bag") {
		const def = BAGS[index];
		return {
			pill: t("shop.bagPill", { capacity: def.capacity }),
			effect: t("shop.bagEffect", { capacity: def.capacity }),
		};
	}
	const def = SHOES[index];
	const faster = def.walkSpeed / BASE_WALK_SPEED - 1;
	return {
		pill: t("shop.shoesPill", { speed: def.walkSpeed }),
		effect: faster > 0 ? t("shop.shoesFaster", { percent: formatPercent(faster) }) : t("shop.shoesNormal"),
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
		<frame BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)}>
			{props.children}
		</frame>
	);
}

function ForSaleFooter(props: { def: GearBase; view: PlayerView }) {
	return (
		<ButtonSlot>
			<BuyButton
				price={props.def.price}
				money={props.view.money}
				verb={t("common.buy")}
				textSize={TEXT_SIZES.small}
				onClick={() => sendToServer(BUY_GEAR_REMOTE, props.def.id)}
			/>
		</ButtonSlot>
	);
}

function footerOf(def: GearBase, view: PlayerView): React.Element {
	const state = gearCardState(def.id, view.gear);
	if (state === "equipped") {
		return <FooterNote text={t("shop.current")} color={COLORS.success} />;
	}
	if (state === "owned") {
		return (
			<ButtonSlot>
				<Button
					text={t("common.equip")}
					variant="success"
					textSize={TEXT_SIZES.small + 2}
					onClick={() => sendToServer(EQUIP_GEAR_REMOTE, def.id)}
				/>
			</ButtonSlot>
		);
	}
	return <ForSaleFooter def={def} view={view} />;
}

/** Pickaxes have the map author's 3D models; bags and shoes keep their emoji. */
function modelOf(id: string): Instance | undefined {
	const pickaxe = PICKAXES.find((def) => def.id === id);
	return pickaxe !== undefined ? pickaxeTemplate(pickaxe.tool) : undefined;
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
			model={modelOf(def.id)}
			name={t(nameKeys.gear(def.id))}
			pill={stats.pill}
			effect={stats.effect}
			rays={props.index === items.size() - 1}
			highlighted={state === "equipped"}
			topLeft={
				state === "equipped"
					? { text: t("common.equipped"), color: COLORS.success }
					: state === "owned"
						? { text: t("common.owned"), color: COLORS.textMuted }
						: undefined
			}
			topRight={def.special !== undefined ? { text: "⚡", color: COLORS.gold } : undefined}
			footer={footerOf(def, props.view)}
			footerHeight={FOOTER_HEIGHT}
			order={props.index}
		/>
	);
}

/** `shop` = what the stand sells (decision 058): one slot shows only that slot, "all" shows the tabs. */
function ShopPanel(props: { shop: ShopSlot }) {
	const view = useView();
	const [chosen, setTab] = useState<GearSlot>("pickaxe");
	const tab: GearSlot = props.shop === "all" ? chosen : props.shop;
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	const items = GEAR_BY_SLOT[tab];
	const icon = TABS.find((entry) => entry.key === tab)?.icon ?? "";
	const equipped = items.find((def) => def.id === view.gear.equipped[tab]) ?? items[0];
	const owned = items.filter((def) => view.gear.owned.includes(def.id)).size();
	return (
		<>
			{props.shop === "all" && (
				<Tabs
					items={TABS.map((entry) => ({ key: entry.key, label: t(entry.label) }))}
					selected={tab}
					onSelect={(key) => {
						if (isGearSlot(key)) {
							setTab(key);
						}
					}}
					order={1}
				/>
			)}
			<Label
				text={t("shop.summary", { name: t(nameKeys.gear(equipped.id)), owned, total: items.size() })}
				tone="muted"
				size={TEXT_SIZES.small + 1}
				order={2}
			/>
			<CardStrip cardWidth={ITEM_CARD_WIDTH} cardHeight={ITEM_CARD_HEIGHT + FOOTER_HEIGHT} order={3}>
				{items.map((def, index) => (
					<StripSlot
						key={def.id}
						width={ITEM_CARD_WIDTH}
						height={ITEM_CARD_HEIGHT + FOOTER_HEIGHT}
						order={index}
					>
						<GearCard slot={tab} icon={icon} index={index} view={view} />
					</StripSlot>
				))}
			</CardStrip>
		</>
	);
}

export function startShopController(): void {
	hideDefaultBackpack();
	startPickaxeSwing();
	// Gear is sold at physical stands (decision 058); the dock's old shop button became the Robux store (store feature).
	onPromptForTag(TAGS.Shop, (stand) => {
		const shop = shopSlotOf(stand.GetAttribute(ATTRIBUTES.ShopSlot));
		const title = shop === "all" ? t("shop.title") : t(`shop.stand.${shop}` as StringKey);
		openPanel({ key: `shop_${shop}`, title, icon: "🛒", render: () => <ShopPanel shop={shop} /> });
	});
}
