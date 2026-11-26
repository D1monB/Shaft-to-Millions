// Sell panel: every line of the bag, the bonus and the exact total BEFORE the player sells,
// plus room for other features to add context (e.g. "worth more if processed in the factory").
import { nameKeys } from "shared/features/i18n";
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
import { Button, COLORS, Card, FONTS, Label, TEXT_SIZES } from "client/lib/ui-kit";
import { startCoinBurst } from "./coin-burst";

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

function SellPanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	const preview = previewSale(view.bag, ORE_IDS, ORES, multiplierOf(view));
	if (preview.itemCount === 0) {
		return <Label text={t("sell.empty")} tone="muted" align="center" />;
	}

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
			<Card order={1}>
				{preview.lines.map((line, index) => (
					<frame
						key={`line_${index}`}
						BackgroundTransparency={1}
						Size={new UDim2(1, 0, 0, 22)}
						LayoutOrder={index}
					>
						<Label text={`${t(nameKeys.ore(line.id))}  ×${line.count}`} width={new UDim(0.6, 0)} />
						<textlabel
							BackgroundTransparency={1}
							AnchorPoint={new Vector2(1, 0)}
							Position={new UDim2(1, 0, 0, 0)}
							Size={new UDim2(0.4, 0, 1, 0)}
							Font={FONTS.display}
							Text={formatMoney(line.subtotal)}
							TextSize={TEXT_SIZES.body}
							TextColor3={COLORS.gold}
							TextXAlignment={Enum.TextXAlignment.Right}
						/>
					</frame>
				))}
				<Label text={t("sell.base", { money: formatMoney(preview.baseTotal) })} tone="muted" order={100} />
				{preview.multiplier > 1 && (
					<Label
						text={t("sell.petBonus", { percent: formatPercent(preview.multiplier - 1) })}
						tone="success"
						order={101}
					/>
				)}
				<Label
					text={t("sell.total", { money: formatMoney(preview.total) })}
					display={true}
					size={TEXT_SIZES.large + 3}
					tone="gold"
					order={102}
				/>
			</Card>
			<Button
				text={t("sell.button", { money: formatMoney(preview.total) })}
				onClick={() => sendToServer(SELL_BAG_REMOTE)}
				order={2}
				height={52}
				textSize={TEXT_SIZES.large}
			/>
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
