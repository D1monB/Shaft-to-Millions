// Equipment panel: active bonuses and their combined effect first, then slots, then the inventory.
// Uses the same shared computeBonuses as the server, and feeds it into every preview on the client.
import { ITEMS, ItemKind, KIND_NAMES, RARITY_COLORS, RARITY_NAMES } from "shared/config/items";
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
import { registerHudButton, registerHudLine } from "client/features/hud";
import { getView } from "client/features/profile";
import { setClientSellMultiplier } from "client/features/selling";
import { sendToServer } from "client/lib/remotes";
import { THEME, makeButton, makeCard, makeLabel, openPanel } from "client/lib/ui";

function bonusesOf(view: PlayerView) {
	return computeBonuses(view.inventory, view.equipped);
}

function colorOf(owned: OwnedItem): Color3 {
	const [r, g, b] = RARITY_COLORS[ITEMS[owned.item].rarity];
	return Color3.fromRGB(r, g, b);
}

function effectText(kind: ItemKind, bonus: number): string {
	if (kind === "pet") {
		return `+${formatPercent(bonus)} до ціни продажу`;
	}
	if (kind === "speedAura") {
		return `+${formatPercent(bonus)} швидкості`;
	}
	return `+${formatPercent(bonus)} шанс додаткової руди`;
}

function render(content: ScrollingFrame): void {
	const view = getView();
	if (view === undefined) {
		return;
	}
	const bonuses = bonusesOf(view);

	// ---- combined effect
	const summary = makeCard(content);
	makeLabel(summary, "Активні бонуси", { bold: true, size: 18, color: THEME.accent });
	makeLabel(
		summary,
		`💰 Продаж: ×${string.format("%.2f", bonuses.sellMultiplier)} (улюбленці +${formatPercent(bonuses.petBonus)})`,
	);
	if (bonuses.petCapped) {
		makeLabel(summary, `Досягнуто стелі бонусу улюбленців (+${formatPercent(BONUS_CAPS.pets)}).`, {
			color: THEME.danger,
			size: 13,
		});
	}
	const base = shoesFor(view.levels.shoes).walkSpeed;
	makeLabel(summary, `👟 Швидкість: ${base} → ${math.floor(walkSpeedFor(view.levels.shoes, bonuses.speedBonus))}`);
	const pickaxe = getPickaxe(view.levels.pickaxe);
	makeLabel(
		summary,
		`⛏ Руда з блоку: в середньому ${string.format("%.2f", 1 + bonuses.yieldBonus)} шт. (${hitsRequired(ORES.iron.hardness, pickaxe.power)} ударів по залізу)`,
	);
	makeButton(content, "Екіпірувати найкраще", () => sendToServer(EQUIP_BEST_REMOTE), view.inventory.size() > 0);

	if (view.inventory.size() === 0) {
		makeLabel(content, "Інвентар порожній. Відкрий скриню біля магазину!", { color: THEME.muted });
		return;
	}

	// ---- items, equipped first, then by strength
	makeLabel(content, `Улюбленці: ${view.equipped.pets.size()}/${MAX_PETS} · аури: по 1 кожного виду`, {
		color: THEME.muted,
	});
	const sorted = [...view.inventory].sort((a, b) => {
		const ea = isEquipped(view.equipped, a.uid);
		const eb = isEquipped(view.equipped, b.uid);
		if (ea !== eb) {
			return ea;
		}
		return ITEMS[a.item].bonus > ITEMS[b.item].bonus;
	});
	for (const owned of sorted) {
		const def = ITEMS[owned.item];
		const equipped = isEquipped(view.equipped, owned.uid);
		const card = makeCard(content);
		makeLabel(card, `${equipped ? "✔ " : ""}${def.name}`, { bold: true, color: colorOf(owned) });
		makeLabel(card, `${RARITY_NAMES[def.rarity]} · ${KIND_NAMES[def.kind]} · ${effectText(def.kind, def.bonus)}`, {
			color: THEME.muted,
			size: 13,
		});
		if (equipped) {
			makeButton(card, "Зняти", () => sendToServer(UNEQUIP_REMOTE, owned.uid));
		} else {
			makeButton(card, "Екіпірувати", () => sendToServer(EQUIP_REMOTE, owned.uid));
			makeButton(card, `Продати за ${formatMoney(itemSellValue(owned.item))}`, () =>
				sendToServer(SELL_ITEM_REMOTE, owned.uid),
			);
		}
	}
}

export function startEquipmentController(): void {
	setClientSellMultiplier((view) => bonusesOf(view).sellMultiplier);
	setFactorySellMultiplier((view) => bonusesOf(view).sellMultiplier);
	setClientSpeedBonus((view) => bonusesOf(view).speedBonus);

	registerHudButton("🎒 Екіпірування", () => openPanel("equipment", "Екіпірування", render));
	registerHudLine(60, (view) => {
		const bonuses = bonusesOf(view);
		if (bonuses.sellMultiplier === 1 && bonuses.speedBonus === 0 && bonuses.yieldBonus === 0) {
			return undefined;
		}
		return `✨ Продаж ×${string.format("%.2f", bonuses.sellMultiplier)} · руда +${formatPercent(bonuses.yieldBonus)}`;
	});
}
