// The upgrade panel of one bought machine: four cards (speed, double output, quality, queue) and the conveyor. The button only sends
// the intent; the server checks the owner, the distance and the price.
import React from "@rbxts/react";
import { BELT_TRACKS, BeltTrack, LINE_MACHINES } from "shared/config/line";
import { formatPercent } from "shared/lib/format";
import { StringKey } from "shared/config/i18n";
import { nameKeys } from "shared/features/i18n";
import {
	LineState,
	UPGRADE_BELT_REMOTE,
	UPGRADE_LINE_MACHINE_REMOTE,
	UpgradeRow,
	beltTrackLevels,
	beltTrackNow,
	hopperCapacity,
	formatUpgradeValue,
	nextBeltLevel,
	upgradeRows,
} from "shared/features/line";
import { useView } from "client/features/profile";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";
import { BuyButton, Card, CardStrip, Label, StripSlot, TEXT_SIZES } from "client/lib/ui-kit";

const CARD_WIDTH = 182;
const CARD_HEIGHT = 224;
/** Room for a two-line hint at the small text size. */
const HINT_HEIGHT = 40;

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
			{/* Always two lines tall, so every card is the same height and the buttons line up (feedback 2026-11-26). */}
			<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, HINT_HEIGHT)} LayoutOrder={4}>
				<Label
					text={t(`line.track.${row.track}.hint` as StringKey)}
					tone="muted"
					size={TEXT_SIZES.small}
					align="center"
				/>
			</frame>
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

/** A belt track value as the player reads it: speed "×1.3", silo "750", polish "+6%". */
function beltValue(track: BeltTrack, value: number): string {
	if (track === "capacity") {
		return `${value}`;
	}
	return track === "polish" ? `+${formatPercent(value)}` : `×${value}`;
}

/** One belt track (decision 069); the speed card also sits in every machine's panel. */
function BeltCard(props: { track: BeltTrack; line: LineState; money: number }) {
	const now = beltTrackNow(props.line, props.track);
	const step = nextBeltLevel(props.line, props.track);
	const key = props.track === "speed" ? "belt" : props.track === "capacity" ? "silo" : "polish";
	return (
		<Card gap={6}>
			<Label
				text={t(`line.track.${key}` as StringKey)}
				display={true}
				size={TEXT_SIZES.body}
				align="center"
				order={1}
			/>
			<Label
				text={t("line.level", { level: now.level, max: beltTrackLevels(props.track).size() })}
				tone="muted"
				size={TEXT_SIZES.small}
				align="center"
				order={2}
			/>
			<Label
				text={
					step !== undefined
						? `${beltValue(props.track, now.value)} → ${beltValue(props.track, step.value)}`
						: beltValue(props.track, now.value)
				}
				tone="gold"
				display={true}
				size={TEXT_SIZES.large}
				align="center"
				order={3}
			/>
			<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, HINT_HEIGHT)} LayoutOrder={4}>
				<Label
					text={t(`line.track.${key}.hint` as StringKey)}
					tone="muted"
					size={TEXT_SIZES.small}
					align="center"
				/>
			</frame>
			{step !== undefined ? (
				<BuyButton
					price={step.price}
					money={props.money}
					verb={t("line.upgrade")}
					onClick={() => sendToServer(UPGRADE_BELT_REMOTE, props.track)}
					textSize={TEXT_SIZES.small}
					order={5}
				/>
			) : (
				<Label text={t("line.maxed")} tone="success" display={true} align="center" order={5} />
			)}
		</Card>
	);
}

/** The belt itself, opened by the prompt on any conveyor piece (decision 069). */
export function BeltPanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	return (
		<>
			<Label
				text={t("line.inSilo", { count: view.line.intake.size(), max: hopperCapacity(view.line) })}
				order={1}
			/>
			<CardStrip cardWidth={CARD_WIDTH} cardHeight={CARD_HEIGHT} order={2}>
				{BELT_TRACKS.map((track, order) => (
					<StripSlot key={track} width={CARD_WIDTH} height={CARD_HEIGHT} order={order}>
						<BeltCard track={track} line={view.line} money={view.money} />
					</StripSlot>
				))}
			</CardStrip>
		</>
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
				<StripSlot key="belt" width={CARD_WIDTH} height={CARD_HEIGHT} order={10}>
					<BeltCard track="speed" line={view.line} money={view.money} />
				</StripSlot>
			</CardStrip>
		</>
	);
}
