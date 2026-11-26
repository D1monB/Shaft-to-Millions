// The upgrade panel of one bought machine: four cards (speed, double output, quality, queue). The button only sends
// the intent; the server checks the owner, the distance and the price.
import React from "@rbxts/react";
import { LINE_MACHINES } from "shared/config/line";
import { StringKey } from "shared/config/i18n";
import { nameKeys } from "shared/features/i18n";
import { UPGRADE_LINE_MACHINE_REMOTE, UpgradeRow, formatUpgradeValue, upgradeRows } from "shared/features/line";
import { useView } from "client/features/profile";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";
import { BuyButton, Card, CardStrip, Label, StripSlot, TEXT_SIZES } from "client/lib/ui-kit";

const CARD_WIDTH = 182;
const CARD_HEIGHT = 224;

function TrackCard(props: { index: number; row: UpgradeRow; money: number }) {
	const row = props.row;
	const next_ = row.upgrade;
	const current = formatUpgradeValue(row.track, row.value);
	return (
		<Card gap={6}>
			<Label
				text={t(`line.track.${row.track}` as StringKey)}
				display={true}
				size={TEXT_SIZES.body}
				align="center"
				order={1}
			/>
			<Label
				text={t("line.level", { level: row.level, max: row.maxLevel })}
				tone="muted"
				size={TEXT_SIZES.small}
				align="center"
				order={2}
			/>
			<Label
				text={next_ !== undefined ? `${current} → ${formatUpgradeValue(row.track, next_.value)}` : current}
				tone="gold"
				display={true}
				size={TEXT_SIZES.large}
				align="center"
				order={3}
			/>
			<Label
				text={t(`line.track.${row.track}.hint` as StringKey)}
				tone="muted"
				size={TEXT_SIZES.small}
				align="center"
				order={4}
			/>
			{next_ !== undefined ? (
				<BuyButton
					price={next_.price}
					money={props.money}
					verb={t("line.upgrade")}
					onClick={() => sendToServer(UPGRADE_LINE_MACHINE_REMOTE, props.index, row.track)}
					textSize={TEXT_SIZES.small}
					order={5}
				/>
			) : (
				<Label text={t("line.maxed")} tone="success" display={true} align="center" order={5} />
			)}
		</Card>
	);
}

export function UpgradePanel(props: { index: number }) {
	const view = useView();
	const def = LINE_MACHINES[props.index];
	const machine = view?.line.machines[props.index];
	if (view === undefined || def === undefined || machine === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	return (
		<>
			<Label text={t("line.makes", { name: t(nameKeys.machineOutput(def.id)) })} display={true} order={1} />
			<Label text={t("line.inQueue", { count: machine.queue.size() })} tone="muted" order={2} />
			<CardStrip cardWidth={CARD_WIDTH} cardHeight={CARD_HEIGHT} order={3}>
				{upgradeRows(view.line, props.index).map((row, order) => (
					<StripSlot key={row.track} width={CARD_WIDTH} height={CARD_HEIGHT} order={order}>
						<TrackCard index={props.index} row={row} money={view.money} />
					</StripSlot>
				))}
			</CardStrip>
		</>
	);
}
