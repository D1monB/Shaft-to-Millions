// The base panel (decision 063): a card per building with its bonus now and next, the build timer with a skip
// button, or the buy button; builders on top. Buttons only send the intent; the server checks everything.
import React from "@rbxts/react";
import { BUILDINGS, BUILDING_IDS, BuildingId, MAIN_BUILDING } from "shared/config/base";
import { StringKey } from "shared/config/i18n";
import {
	BaseState,
	HIRE_BUILDER_REMOTE,
	MAX_BUILDERS,
	SKIP_BUILD_REMOTE,
	START_BUILD_REMOTE,
	jobOf,
	levelOf,
	nextBuilderPrice,
	nextBuildingLevel,
	officeNeeded,
	secondsLeft,
	skipCost,
} from "shared/features/base";
import { nameKeys } from "shared/features/i18n";
import { PlayerView } from "shared/features/profile";
import { formatDuration, formatPercent } from "shared/lib/format";
import { useView } from "client/features/profile";
import { useServerClock } from "client/lib/hooks";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";
import { BuyButton, Button, COLORS, Card, Label, ProgressBar, TEXT_SIZES } from "client/lib/ui-kit";

export const BUILDING_ICONS: { readonly [K in BuildingId]: string } = {
	office: "🏛",
	market: "🏪",
	warehouse: "📦",
	workshop: "🔧",
	lab: "🧪",
	hut: "⛏",
};

/** The building's bonus at `level` as the player reads it. */
function bonusText(id: BuildingId, level: number): string {
	const amount = BUILDINGS[id].perLevel * level;
	const key = `base.bonus.${id}` as StringKey;
	if (id === "office") {
		return t(key, { value: level });
	}
	if (id === "lab") {
		return t(key, { value: amount / 60 });
	}
	return t(key, { value: formatPercent(amount) });
}

function BuildingCard(props: { id: BuildingId; view: PlayerView; now: number; order: number }) {
	const state: BaseState = props.view.base;
	const id = props.id;
	const level = levelOf(state, id);
	const max = BUILDINGS[id].levels.size();
	const job = jobOf(state, id);
	const upcoming = nextBuildingLevel(state, id);
	const office = upcoming !== undefined ? officeNeeded(id, upcoming.level) : 0;
	const locked = levelOf(state, MAIN_BUILDING) < office;
	const left = secondsLeft(state, id, props.now);
	const total = job !== undefined && upcoming !== undefined ? upcoming.seconds : 0;
	return (
		<Card order={props.order} gap={5} accent={job !== undefined ? COLORS.gold : undefined}>
			<Label
				text={`${BUILDING_ICONS[id]}  ${t(nameKeys.building(id))}   ${level}/${max}`}
				display={true}
				size={TEXT_SIZES.large}
				order={1}
			/>
			<Label
				text={
					upcoming !== undefined
						? `${bonusText(id, level)}  →  ${bonusText(id, upcoming.level)}`
						: bonusText(id, level)
				}
				tone="success"
				size={TEXT_SIZES.small}
				order={2}
			/>
			{job !== undefined ? (
				<>
					<ProgressBar
						progress={total > 0 ? 1 - left / total : 0}
						text={`🏗 ${formatDuration(left)}`}
						height={22}
						order={3}
					/>
					<Button
						text={t("base.skip", { count: skipCost(left) })}
						variant="primary"
						disabled={props.view.crystals < skipCost(left)}
						height={42}
						onClick={() => sendToServer(SKIP_BUILD_REMOTE, id)}
						order={4}
					/>
				</>
			) : upcoming === undefined ? (
				<Label text={t("line.maxed")} tone="success" display={true} order={3} />
			) : locked ? (
				<Label text={t("base.needOffice", { level: office })} tone="danger" order={3} />
			) : (
				<>
					<Label
						text={t("base.time", { time: formatDuration(upcoming.seconds) })}
						tone="muted"
						size={TEXT_SIZES.small}
						order={3}
					/>
					<BuyButton
						price={upcoming.price}
						money={props.view.money}
						verb={level === 0 ? t("common.build") : t("line.upgrade")}
						onClick={() => sendToServer(START_BUILD_REMOTE, id)}
						order={4}
					/>
				</>
			)}
		</Card>
	);
}

function Builders(props: { view: PlayerView }) {
	const state = props.view.base;
	const price = nextBuilderPrice(state);
	return (
		<Card order={1} gap={5}>
			<Label
				text={t("base.builders", { busy: state.jobs.size(), total: state.builders, max: MAX_BUILDERS })}
				display={true}
				order={1}
			/>
			<Label text={t("base.hint")} tone="muted" size={TEXT_SIZES.small} order={2} />
			{price !== undefined && (
				<Button
					text={t("base.hire", { count: price })}
					variant="success"
					disabled={props.view.crystals < price}
					height={40}
					onClick={() => sendToServer(HIRE_BUILDER_REMOTE)}
					order={3}
				/>
			)}
		</Card>
	);
}

export function BasePanel() {
	const view = useView();
	const now = useServerClock(1);
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	return (
		<>
			<Builders view={view} />
			{BUILDING_IDS.map((id, index) => (
				<BuildingCard key={id} id={id} view={view} now={now} order={2 + index} />
			))}
		</>
	);
}
