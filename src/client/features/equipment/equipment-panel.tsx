// Equipment panel: active bonuses first, then the items by category (tabs), one card per kind of item.
// Uses the same shared computeBonuses as the server, and feeds it into every preview on the client.
import React, { useState } from "@rbxts/react";
import { ITEMS, ItemKind } from "shared/config/items";
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
import { setClientSpeedBonus } from "client/features/drill";
import { setFactorySellMultiplier } from "client/features/factory";
import { registerHudButton, registerHudStat } from "client/features/hud";
import { useView } from "client/features/profile";
import { setClientSellMultiplier } from "client/features/selling";
import { ITEM_CARD_FOOTER, ITEM_CARD_HEIGHT, ItemCard } from "client/lib/item-card";
import { openPanel } from "client/lib/panels";
import { sendToServer } from "client/lib/remotes";
import { Button, ButtonRow, COLORS, Card, Label, TEXT_SIZES, Tabs, rowItemWidth } from "client/lib/ui-kit";

function bonusesOf(view: PlayerView) {
	return computeBonuses(view.inventory, view.equipped);
}

function Summary(props: { view: PlayerView }) {
	const view = props.view;
	const bonuses = bonusesOf(view);
	const base = shoesFor(view.levels.shoes).walkSpeed;
	const pickaxe = getPickaxe(view.levels.pickaxe);
	return (
		<Card order={1} accent={COLORS.gold}>
			<Label text="Активні бонуси" display={true} tone="gold" size={TEXT_SIZES.large} order={1} />
			<Label
				text={`💰 Продаж ×${string.format("%.2f", bonuses.sellMultiplier)} (улюбленці +${formatPercent(bonuses.petBonus)})`}
				order={2}
			/>
			{bonuses.petCapped && (
				<Label
					text={`Досягнуто стелі бонусу улюбленців (+${formatPercent(BONUS_CAPS.pets)}).`}
					tone="danger"
					size={TEXT_SIZES.small}
					order={3}
				/>
			)}
			<Label
				text={`👟 Швидкість ${base} → ${math.floor(walkSpeedFor(view.levels.shoes, bonuses.speedBonus))}`}
				order={4}
			/>
			<Label
				text={`⛏ Руда з блоку: ~${string.format("%.2f", 1 + bonuses.yieldBonus)} шт. (${hitsRequired(ORES.iron.hardness, pickaxe.power)} ударів по залізу)`}
				order={5}
			/>
		</Card>
	);
}

const TABS: ReadonlyArray<{ readonly key: ItemKind; readonly label: string }> = [
	{ key: "pet", label: "🐾 Улюбленці" },
	{ key: "speedAura", label: "💨 Швидкість" },
	{ key: "pickaxeAura", label: "✨ Кирка" },
];

function isKind(value: string): value is ItemKind {
	return value === "pet" || value === "speedAura" || value === "pickaxeAura";
}

/** What is in the slots of this kind right now. */
function slotText(view: PlayerView, kind: ItemKind): string {
	if (kind === "pet") {
		return `Надіто улюбленців: ${view.equipped.pets.size()}/${MAX_PETS}. Кожен збільшує ціну продажу.`;
	}
	const uid = kind === "speedAura" ? view.equipped.speedAura : view.equipped.pickaxeAura;
	const owned = uid === undefined ? undefined : view.inventory.find((entry) => entry.uid === uid);
	const slot = kind === "speedAura" ? "Аура швидкості" : "Аура кирки";
	return owned === undefined ? `${slot}: не надіто (1 слот).` : `${slot}: ${ITEMS[owned.item].name} (1 слот).`;
}

/** One kind of item: the card with a count, and its buttons. Actions use the first copy of the group. */
function InventoryCard(props: { group: ItemGroup; order: number }) {
	const group = props.group;
	const uid = group.uids[0];
	const count = group.uids.size();
	const footer = group.equipped ? (
		<Button text="Зняти" variant="secondary" onClick={() => sendToServer(UNEQUIP_REMOTE, uid)} />
	) : (
		<ButtonRow count={2}>
			<Button
				text="Надіти"
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
			topLeft={group.equipped ? { text: "✔ НАДІТО", color: COLORS.success } : undefined}
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
		return <Label text="Завантаження..." tone="muted" />;
	}
	const groups = groupInventory(view.inventory, view.equipped, tab);
	return (
		<>
			<Summary view={view} />
			<Button
				text="⭐ Надіти найкраще"
				onClick={() => sendToServer(EQUIP_BEST_REMOTE)}
				disabled={view.inventory.size() === 0}
				order={2}
			/>
			<Tabs
				items={TABS.map((entry) => ({
					key: entry.key,
					label: entry.label,
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
				<Label
					text="Тут поки порожньо. Відкрий скриню біля магазину! 🎁"
					tone="muted"
					align="center"
					order={5}
				/>
			) : (
				<Card order={5}>
					<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 0)} AutomaticSize={Enum.AutomaticSize.Y}>
						<uigridlayout
							CellSize={new UDim2(1 / 3, -8, 0, ITEM_CARD_HEIGHT + ITEM_CARD_FOOTER)}
							CellPadding={new UDim2(0, 12, 0, 14)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						{groups.map((group, index) => (
							<InventoryCard key={`${group.item}_${group.equipped}`} group={group} order={index} />
						))}
					</frame>
				</Card>
			)}
		</>
	);
}

export function startEquipmentController(): void {
	setClientSellMultiplier((view) => bonusesOf(view).sellMultiplier);
	setFactorySellMultiplier((view) => bonusesOf(view).sellMultiplier);
	setClientSpeedBonus((view) => bonusesOf(view).speedBonus);

	registerHudButton(
		"🎒",
		"Речі",
		() => openPanel({ key: "equipment", title: "Екіпірування", icon: "🎒", render: () => <EquipmentPanel /> }),
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
			text: `Бонуси: продаж ×${string.format("%.2f", bonuses.sellMultiplier)} · руда +${formatPercent(bonuses.yieldBonus)}`,
			short: `×${string.format("%.2f", bonuses.sellMultiplier)}`,
			tone: "success",
		};
	});
}
