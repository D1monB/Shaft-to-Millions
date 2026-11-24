// Sell panel: shows every line of the bag, the bonus and the exact total BEFORE the player sells,
// plus room for other features to add context (e.g. "worth more if processed in the factory").
import { TAGS } from "shared/config/map-contract";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PlayerView } from "shared/features/profile";
import { SELL_BAG_REMOTE, previewSale } from "shared/features/selling";
import { formatMoney, formatPercent } from "shared/lib/format";
import { getView } from "client/features/profile";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import { THEME, makeButton, makeCard, makeLabel, openPanel } from "client/lib/ui";

let multiplierOf: (view: PlayerView) => number = () => 1;
const extras: Array<(content: ScrollingFrame, view: PlayerView) => void> = [];

/** Equipment sets this so the preview includes pet bonuses, computed by the same shared formula as the server. */
export function setClientSellMultiplier(provider: (view: PlayerView) => number): void {
	multiplierOf = provider;
}

/** Adds a block under the sale summary. */
export function registerSellPanelExtra(render: (content: ScrollingFrame, view: PlayerView) => void): void {
	extras.push(render);
}

function render(content: ScrollingFrame): void {
	const view = getView();
	if (view === undefined) {
		makeLabel(content, "Завантаження...");
		return;
	}
	const preview = previewSale(view.bag, ORE_IDS, ORES, multiplierOf(view));
	if (preview.itemCount === 0) {
		makeLabel(content, "Сумка порожня. Повертайся з рудою!", { color: THEME.muted });
		return;
	}

	const card = makeCard(content);
	for (const line of preview.lines) {
		makeLabel(card, `${line.name}: ${line.count} × ${formatMoney(line.unitPrice)} = ${formatMoney(line.subtotal)}`);
	}
	makeLabel(card, `Разом без бонусів: ${formatMoney(preview.baseTotal)}`, { color: THEME.muted });
	if (preview.multiplier > 1) {
		makeLabel(card, `Бонус улюбленців: +${formatPercent(preview.multiplier - 1)}`, { color: THEME.success });
	}
	makeLabel(card, `Отримаєш: ${formatMoney(preview.total)}`, { bold: true, size: 20, color: THEME.accent });

	makeButton(content, `Продати все за ${formatMoney(preview.total)}`, () => sendToServer(SELL_BAG_REMOTE));

	for (const extra of extras) {
		extra(content, view);
	}
}

export function startSellController(): void {
	onPromptForTag(TAGS.SellZone, () => openPanel("sell", "Скупка руди", render));
}
