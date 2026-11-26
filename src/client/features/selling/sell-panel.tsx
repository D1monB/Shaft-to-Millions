// Sell panel: every line of the bag, the bonus and the exact total BEFORE the player sells,
// plus room for other features to add context (e.g. "worth more if processed in the factory").
import { bagCapacity, bagTotal } from "shared/features/bag";
import { boostMultiplier } from "shared/features/boosters";
import { itemValue, lineIncome } from "shared/features/line";
import { OreId, isOreId } from "shared/config/ores";
import { t } from "client/lib/i18n";
import React from "@rbxts/react";
import { TAGS } from "shared/config/map-contract";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PlayerView } from "shared/features/profile";
import { SELL_BAG_REMOTE, previewSale } from "shared/features/selling";
import { formatMoney, formatPercent } from "shared/lib/format";
import { useView } from "client/features/profile";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import { Button, COLORS, Card, Label, ProgressBar, TEXT_SIZES } from "client/lib/ui-kit";
import { startCoinBurst } from "./coin-burst";
import { Chip, OreStrip, TotalBanner } from "./sale-widgets";

let multiplierOf: (view: PlayerView) => number = () => 1;
const extras: Array<(view: PlayerView) => React.Element | undefined> = [];

/** Equipment sets this so the preview includes pet bonuses, computed by the same shared formula as the server. */
export function setClientSellMultiplier(provider: (view: PlayerView) => number): void {
	multiplierOf = provider;
}

/** Adds a block under the sale summary. */
export function registerSellPanelExtra(render: (view: PlayerView) => React.Element | undefined): void {
	extras.push(render);
}

/** What the same bag would pay after riding the whole owned line (before duplicates), with the same bonuses. */
function lineWorth(view: PlayerView, multiplier: number, rows: ReadonlyArray<{ id: string; count: number }>): number {
	const last = view.line.machines.size() - 1;
	if (last < 0) {
		return 0;
	}
	let total = 0;
	for (const row of rows) {
		const value = itemValue(view.line, row.id, last, (ore) => (isOreId(ore) ? ORES[ore].price : undefined));
		total += (value ?? 0) * row.count;
	}
	return lineIncome(total, multiplier);
}

function EmptyBag() {
	return (
		<Card order={1} gap={6}>
			<Label text="🎒" size={56} align="center" order={1} />
			<Label text={t("sell.empty")} display={true} align="center" order={2} />
			<Label text={t("sell.emptyHint")} tone="muted" align="center" order={3} />
		</Card>
	);
}

function SellPanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	const pets = multiplierOf(view);
	const boost = boostMultiplier(view.boosts, "money", os.time());
	// The server multiplies pets by the money booster, so the preview does too.
	const preview = previewSale(view.bag, ORE_IDS, ORES, pets * boost);
	if (preview.itemCount === 0) {
		return <EmptyBag />;
	}
	const capacity = bagCapacity(view.gear.equipped.bag);
	const used = bagTotal(view.bag);
	const rows = preview.lines.map((line) => ({ id: line.id as OreId, count: line.count, subtotal: line.subtotal }));
	const chips: Chip[] = [];
	if (pets > 1) {
		chips.push({ text: t("sell.petBonus", { percent: formatPercent(pets - 1) }), color: COLORS.success });
	}
	if (boost > 1) {
		chips.push({ text: t("sell.boostChip", { value: boost }), color: COLORS.crystal });
	}
	const worth = lineWorth(view, preview.multiplier, rows);

	const extraBlocks: React.Element[] = [];
	extras.forEach((extra, index) => {
		const block = extra(view);
		if (block !== undefined) {
			extraBlocks.push(
				<frame
					key={`extra_${index}`}
					BackgroundTransparency={1}
					Size={new UDim2(1, 0, 0, 0)}
					AutomaticSize={Enum.AutomaticSize.Y}
					LayoutOrder={10 + index}
				>
					{block}
				</frame>,
			);
		}
	});

	return (
		<>
			<TotalBanner total={preview.total} items={preview.itemCount} chips={chips} order={1} />
			<ProgressBar
				progress={capacity > 0 ? used / capacity : 0}
				text={`🎒 ${used} / ${capacity}`}
				height={20}
				color={used >= capacity ? COLORS.canyon : COLORS.gold}
				order={2}
			/>
			<OreStrip rows={rows} order={3} />
			<Button
				text={t("sell.button", { money: formatMoney(preview.total) })}
				onClick={() => sendToServer(SELL_BAG_REMOTE)}
				order={4}
				height={56}
				textSize={TEXT_SIZES.large}
				shine={true}
			/>
			{worth > preview.total && (
				<Card order={5} gap={4} accent={COLORS.success}>
					<Label
						text={t("sell.lineWorth", { money: formatMoney(worth) })}
						display={true}
						tone="success"
						order={1}
					/>
					<Label text={t("sell.lineWorthHint")} tone="muted" size={TEXT_SIZES.small} order={2} />
				</Card>
			)}
			{extraBlocks}
		</>
	);
}

export function startSellController(): void {
	startCoinBurst();
	onPromptForTag(TAGS.SellZone, () =>
		openPanel({ key: "sell", title: t("sell.title"), icon: "💰", render: () => <SellPanel /> }),
	);
}
