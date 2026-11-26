// Equipment panel: active bonuses first, then the items by category (tabs), one card per kind of item.
// Uses the same shared computeBonuses as the server, and feeds it into every preview on the client.
import { StringKey } from "shared/config/i18n";
import { nameKeys } from "shared/features/i18n";
import { t } from "client/lib/i18n";
import React, { useState } from "@rbxts/react";
import { ItemKind } from "shared/config/items";
import { ORES } from "shared/config/ores";
import {
	BONUS_CAPS,
	EQUIP_BEST_REMOTE,
	EQUIP_REMOTE,
	MAX_PETS,
	SELL_ITEM_REMOTE,
	UNEQUIP_REMOTE,
	ItemGroup,
	computeBonuses,
	countOfKind,
	groupInventory,
	itemSellValue,
} from "shared/features/equipment";
import { getPickaxe, hitsRequired } from "shared/features/mining";
import { shoesFor, walkSpeedFor } from "shared/features/movement";
import { PlayerView } from "shared/features/profile";
import { formatMoney, formatPercent } from "shared/lib/format";
import { registerHudButton, registerHudStat } from "client/features/hud";
import { useView } from "client/features/profile";
import { setClientSellMultiplier } from "client/features/selling";
import { ITEM_CARD_FOOTER, ITEM_CARD_HEIGHT, ITEM_CARD_WIDTH, ItemCard } from "client/lib/item-card";
import { openPanel } from "client/lib/panels";
import { sendToServer } from "client/lib/remotes";
import {
	Button,
	ButtonRow,
	COLORS,
	CardStrip,
	Label,
	StripSlot,
	TEXT_SIZES,
	Tabs,
	rowItemWidth,
} from "client/lib/ui-kit";

function bonusesOf(view: PlayerView) {
	return computeBonuses(view.inventory, view.equipped);
}

/** The active bonuses in one short line, so the item row fits without scrolling down. */
function Summary(props: { view: PlayerView }) {
	const view = props.view;
	const bonuses = bonusesOf(view);
	const base = shoesFor(view.gear.equipped.shoes).walkSpeed;
	const pickaxe = getPickaxe(view.gear.equipped.pickaxe);
	const speed = math.floor(walkSpeedFor(view.gear.equipped.shoes, bonuses.speedBonus));
	const sell = t("equip.sell", { value: string.format("%.2f", bonuses.sellMultiplier) });
	const walk = t("equip.walk", { base, speed });
	const ore = t("equip.ore", {
		amount: string.format("%.2f", 1 + bonuses.yieldBonus),
		hits: hitsRequired(ORES.iron.hardness, pickaxe.power),
	});
	return (
		<>
			<Label text={`${sell}   ·   ${walk}   ·   ${ore}`} tone="gold" size={TEXT_SIZES.small + 1} order={1} />
			{bonuses.petCapped && (
				<Label
					text={t("equip.petCap", { percent: formatPercent(BONUS_CAPS.pets) })}
					tone="danger"
					size={TEXT_SIZES.small}
					order={2}
				/>
			)}
		</>
	);
}

/** Pinned under the item row: one tap puts on the best items. */
function EquipmentFooter() {
	const view = useView();
	return (
		<Button
			text={t("equip.best")}
			onClick={() => sendToServer(EQUIP_BEST_REMOTE)}
			disabled={view === undefined || view.inventory.size() === 0}
			order={1}
		/>
	);
}

const TABS: ReadonlyArray<{ readonly key: ItemKind; readonly label: StringKey }> = [
	{ key: "pet", label: "equip.tab.pet" },
	{ key: "speedAura", label: "equip.tab.speedAura" },
	{ key: "pickaxeAura", label: "equip.tab.pickaxeAura" },
];

function isKind(value: string): value is ItemKind {
	return value === "pet" || value === "speedAura" || value === "pickaxeAura";
}

/** What is in the slots of this kind right now. */
function slotText(view: PlayerView, kind: ItemKind): string {
	if (kind === "pet") {
		return t("equip.petsInfo", { count: view.equipped.pets.size(), max: MAX_PETS });
	}
	const uid = kind === "speedAura" ? view.equipped.speedAura : view.equipped.pickaxeAura;
	const owned = uid === undefined ? undefined : view.inventory.find((entry) => entry.uid === uid);
	const slot = t(nameKeys.kind(kind));
	return owned === undefined
		? t("equip.slotEmpty", { slot })
		: t("equip.slotItem", { slot, item: t(nameKeys.item(owned.item)) });
}

/** One kind of item: the card with a count, and its buttons. Actions use the first copy of the group. */
function InventoryCard(props: { group: ItemGroup; order: number }) {
	const group = props.group;
	const uid = group.uids[0];
	const count = group.uids.size();
	const footer = group.equipped ? (
		<Button text={t("common.unequip")} variant="secondary" onClick={() => sendToServer(UNEQUIP_REMOTE, uid)} />
	) : (
		<ButtonRow count={2}>
			<Button
				text={t("common.equip")}
				variant="success"
				onClick={() => sendToServer(EQUIP_REMOTE, uid)}
				width={rowItemWidth(2)}
				order={1}
			/>
			<Button
				text={formatMoney(itemSellValue(group.item))}
				variant="danger"
				onClick={() => sendToServer(SELL_ITEM_REMOTE, uid)}
				width={rowItemWidth(2)}
				order={2}
			/>
		</ButtonRow>
	);
	return (
		<ItemCard
			item={group.item}
			topLeft={group.equipped ? { text: t("common.equipped"), color: COLORS.success } : undefined}
			topRight={count > 1 ? { text: `×${count}`, color: COLORS.gold } : undefined}
			highlighted={group.equipped}
			footer={footer}
			order={props.order}
		/>
	);
}

function EquipmentPanel() {
	const view = useView();
	const [tab, setTab] = useState<ItemKind>("pet");
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	const groups = groupInventory(view.inventory, view.equipped, tab);
	return (
		<>
			<Summary view={view} />
			<Tabs
				items={TABS.map((entry) => ({
					key: entry.key,
					label: t(entry.label),
					count: countOfKind(view.inventory, entry.key),
				}))}
				selected={tab}
				onSelect={(key) => {
					if (isKind(key)) {
						setTab(key);
					}
				}}
				order={3}
			/>
			<Label text={slotText(view, tab)} tone="muted" size={TEXT_SIZES.small + 1} order={4} />
			{groups.size() === 0 ? (
				<Label text={t("equip.empty")} tone="muted" align="center" order={5} />
			) : (
				<CardStrip cardWidth={ITEM_CARD_WIDTH} cardHeight={ITEM_CARD_HEIGHT + ITEM_CARD_FOOTER} order={5}>
					{groups.map((group, index) => (
						<StripSlot
							key={`${group.item}_${group.equipped}`}
							width={ITEM_CARD_WIDTH}
							height={ITEM_CARD_HEIGHT + ITEM_CARD_FOOTER}
							order={index}
						>
							<InventoryCard group={group} order={index} />
						</StripSlot>
					))}
				</CardStrip>
			)}
		</>
	);
}

export function startEquipmentController(): void {
	setClientSellMultiplier((view) => bonusesOf(view).sellMultiplier);

	registerHudButton(
		"🎒",
		() => t("menu.items"),
		() =>
			openPanel({
				key: "equipment",
				title: t("equip.title"),
				icon: "🎒",
				render: () => <EquipmentPanel />,
				footer: () => <EquipmentFooter />,
			}),
		10,
		"crystal",
	);
	registerHudStat(60, (view) => {
		const bonuses = bonusesOf(view);
		if (bonuses.sellMultiplier === 1 && bonuses.speedBonus === 0 && bonuses.yieldBonus === 0) {
			return undefined;
		}
		return {
			icon: "✨",
			text: t("hud.bonuses", {
				sell: string.format("%.2f", bonuses.sellMultiplier),
				ore: formatPercent(bonuses.yieldBonus),
			}),
			short: `×${string.format("%.2f", bonuses.sellMultiplier)}`,
			tone: "success",
		};
	});
}
