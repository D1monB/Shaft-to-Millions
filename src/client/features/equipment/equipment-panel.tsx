// Equipment panel: active bonuses and their combined effect first, then the items.
// Uses the same shared computeBonuses as the server, and feeds it into every preview on the client.
import React from "@rbxts/react";
import { ITEMS, RARITY_NAMES } from "shared/config/items";
import { ORES } from "shared/config/ores";
import type { OwnedItem } from "shared/features/chests";
import {
	BONUS_CAPS,
	EQUIP_BEST_REMOTE,
	EQUIP_REMOTE,
	MAX_PETS,
	SELL_ITEM_REMOTE,
	UNEQUIP_REMOTE,
	computeBonuses,
	isEquipped,
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
import { KIND_ICONS, effectText, rarityColor } from "client/lib/item-display";
import { openPanel } from "client/lib/panels";
import { sendToServer } from "client/lib/remotes";
import { Button, ButtonRow, COLORS, Card, Label, TEXT_SIZES, rowItemWidth } from "client/lib/ui-kit";

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

function ItemCard(props: { view: PlayerView; owned: OwnedItem; order: number }) {
	const def = ITEMS[props.owned.item];
	const equipped = isEquipped(props.view.equipped, props.owned.uid);
	const color = rarityColor(props.owned.item);
	const uid = props.owned.uid;
	return (
		<Card order={props.order} accent={equipped ? COLORS.success : color}>
			<Label
				text={`${KIND_ICONS[def.kind]} ${def.name}${equipped ? "  ✔" : ""}`}
				display={true}
				color={color}
				order={1}
			/>
			<Label
				text={`${RARITY_NAMES[def.rarity]} · ${effectText(def.kind, def.bonus)}`}
				tone="muted"
				size={TEXT_SIZES.small + 1}
				order={2}
			/>
			{equipped ? (
				<Button text="Зняти" variant="secondary" onClick={() => sendToServer(UNEQUIP_REMOTE, uid)} order={3} />
			) : (
				<ButtonRow count={2} order={3}>
					<Button
						text="Екіпірувати"
						onClick={() => sendToServer(EQUIP_REMOTE, uid)}
						width={rowItemWidth(2)}
						order={1}
					/>
					<Button
						text={`Продати ${formatMoney(itemSellValue(props.owned.item))}`}
						variant="danger"
						onClick={() => sendToServer(SELL_ITEM_REMOTE, uid)}
						width={rowItemWidth(2)}
						order={2}
					/>
				</ButtonRow>
			)}
		</Card>
	);
}

function EquipmentPanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	// Equipped first, then by strength.
	const sorted = [...view.inventory].sort((a, b) => {
		const ea = isEquipped(view.equipped, a.uid);
		const eb = isEquipped(view.equipped, b.uid);
		if (ea !== eb) {
			return ea;
		}
		return ITEMS[a.item].bonus > ITEMS[b.item].bonus;
	});
	return (
		<>
			<Summary view={view} />
			<Button
				text="⭐ Екіпірувати найкраще"
				onClick={() => sendToServer(EQUIP_BEST_REMOTE)}
				disabled={view.inventory.size() === 0}
				order={2}
			/>
			{view.inventory.size() === 0 ? (
				<Label
					text="Інвентар порожній. Відкрий скриню біля магазину! 🎁"
					tone="muted"
					align="center"
					order={3}
				/>
			) : (
				<Label
					text={`🐾 Улюбленці: ${view.equipped.pets.size()}/${MAX_PETS} · аури: по 1 кожного виду`}
					tone="muted"
					order={3}
				/>
			)}
			{sorted.map((owned, index) => (
				<ItemCard key={owned.uid} view={view} owned={owned} order={10 + index} />
			))}
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
