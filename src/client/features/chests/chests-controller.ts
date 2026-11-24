// Chest panel: the full odds table BEFORE any payment (Roblox policy), then a clear result screen.
import { MarketplaceService, Players } from "@rbxts/services";
import { CHESTS, ChestId, isChestId } from "shared/config/chests";
import { INVENTORY_LIMIT, ITEMS, KIND_NAMES, RARITY_COLORS, RARITY_NAMES, isItemId } from "shared/config/items";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import {
	CHEST_RESULT_REMOTE,
	OPEN_CHEST_REMOTE,
	ROBUX_CHESTS_ALLOWED_ATTRIBUTE,
	chestOdds,
} from "shared/features/chests";
import { formatMoney, formatPercent } from "shared/lib/format";
import { registerHudLine } from "client/features/hud";
import { getView } from "client/features/profile";
import { onPromptForTag } from "client/lib/prompts";
import { onServerMessage, sendToServer } from "client/lib/remotes";
import { THEME, makeButton, makeCard, makeLabel, openPanel, toast } from "client/lib/ui";

/** Robux is offered only when the server says so (fail closed, same as the server). */
function robuxAllowed(): boolean {
	return Players.LocalPlayer.GetAttribute(ROBUX_CHESTS_ALLOWED_ATTRIBUTE) === true;
}

function rarityColor(item: keyof typeof ITEMS): Color3 {
	const [r, g, b] = RARITY_COLORS[ITEMS[item].rarity];
	return Color3.fromRGB(r, g, b);
}

function bonusText(item: keyof typeof ITEMS): string {
	const def = ITEMS[item];
	if (def.kind === "pet") {
		return `+${formatPercent(def.bonus)} до ціни продажу`;
	}
	if (def.kind === "speedAura") {
		return `+${formatPercent(def.bonus)} до швидкості`;
	}
	return `+${formatPercent(def.bonus)} шанс додаткової руди`;
}

function renderChest(chestId: ChestId): (content: ScrollingFrame) => void {
	return (content) => {
		const view = getView();
		if (view === undefined) {
			return;
		}
		const chest = CHESTS[chestId];
		makeLabel(content, chest.description, { color: THEME.muted });

		const odds = makeCard(content);
		makeLabel(odds, "Що може випасти (шанси):", { bold: true });
		for (const line of chestOdds(chestId)) {
			const def = ITEMS[line.item];
			makeLabel(
				odds,
				`${formatPercent(line.chance)} · ${def.name} (${RARITY_NAMES[def.rarity]}) · ${bonusText(line.item)}`,
				{
					color: rarityColor(line.item),
				},
			);
		}

		const full = view.inventory.size() >= INVENTORY_LIMIT;
		makeLabel(content, `Предметів: ${view.inventory.size()}/${INVENTORY_LIMIT}`, {
			color: full ? THEME.danger : THEME.muted,
		});

		const affordable = view.money >= chest.dollarPrice;
		makeButton(
			content,
			affordable
				? `Відкрити за ${formatMoney(chest.dollarPrice)}`
				: `${formatMoney(chest.dollarPrice)} (бракує ${formatMoney(chest.dollarPrice - view.money)})`,
			() => sendToServer(OPEN_CHEST_REMOTE, chestId),
			affordable && !full,
		);

		const productId = chest.robuxProductId;
		if (productId === undefined) {
			makeLabel(content, "Відкриття за Robux ще не налаштоване.", { color: THEME.muted, size: 13 });
		} else if (!robuxAllowed()) {
			makeLabel(content, "Відкриття за Robux недоступне для твого акаунта.", { color: THEME.muted, size: 13 });
		} else {
			makeButton(
				content,
				`Відкрити за R$ ${chest.robuxPrice}`,
				() => MarketplaceService.PromptProductPurchase(Players.LocalPlayer, productId),
				!full,
			);
		}
		makeLabel(content, "Гра повністю проходиться без Robux.", { color: THEME.muted, size: 13 });
	};
}

function showResult(item: keyof typeof ITEMS, chestId: ChestId): void {
	const def = ITEMS[item];
	toast(`Випало: ${def.name}!`, "success", 4);
	openPanel("chest_result", "Скриня відкрита!", (content) => {
		makeLabel(content, def.name, { bold: true, size: 28, color: rarityColor(item) });
		makeLabel(content, `${RARITY_NAMES[def.rarity]} · ${KIND_NAMES[def.kind]}`, { color: rarityColor(item) });
		makeLabel(content, bonusText(item), { size: 18 });
		makeLabel(content, "Предмет уже в інвентарі. Екіпіруй його кнопкою «Екіпірування».", { color: THEME.muted });
		makeButton(content, "Ще раз", () => openPanel(`chest_${chestId}`, CHESTS[chestId].name, renderChest(chestId)));
	});
}

export function startChestsController(): void {
	onPromptForTag(TAGS.Chest, (instance) => {
		const chestId = instance.GetAttribute(ATTRIBUTES.ChestId);
		if (isChestId(chestId)) {
			openPanel(`chest_${chestId}`, CHESTS[chestId].name, renderChest(chestId));
		}
	});
	onServerMessage(CHEST_RESULT_REMOTE, (item, chestId) => {
		if (isItemId(item) && isChestId(chestId)) {
			showResult(item, chestId);
		}
	});
	registerHudLine(50, (view) =>
		view.inventory.size() > 0 ? `🎁 Предмети: ${view.inventory.size()}/${INVENTORY_LIMIT}` : undefined,
	);
}
