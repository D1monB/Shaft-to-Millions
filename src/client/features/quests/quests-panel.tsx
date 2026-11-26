// The quests panel (decision 055): login streak, today's three quests, the active story quest. Buttons only name the
// reward to claim; the server checks that it is earned. A finished quest gets a gold outline and a shining button.
import React from "@rbxts/react";
import { CHAIN_QUESTS, DAILY_ALL_DONE_REWARD, QuestDef, QuestReward } from "shared/config/quests";
import { StringKey } from "shared/config/i18n";
import { nameKeys } from "shared/features/i18n";
import { PlayerView } from "shared/features/profile";
import {
	CLAIM_QUEST_REMOTE,
	QuestSnapshot,
	dayOf,
	findDaily,
	questProgress,
	scaledDaily,
	streakReward,
} from "shared/features/quests";
import { formatMoney } from "shared/lib/format";
import { useView } from "client/features/profile";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";
import { Button, COLORS, Card, Label, ProgressBar, TEXT_SIZES } from "client/lib/ui-kit";

export function snapshotOf(view: PlayerView): QuestSnapshot {
	let drills = 0;
	for (const [, drill] of pairs(view.drills)) {
		if (drill !== undefined) {
			drills += 1;
		}
	}
	return {
		machines: view.line.machines.size(),
		deepestLayer: view.deepestLayer,
		ownedGear: view.gear.owned,
		beltLevel: view.line.beltLevel,
		drills,
	};
}

/** The quest as a sentence: "Mine 250 copper", "Buy Leather Bag". */
export function questText(def: QuestDef): string {
	const target = def.kind === "earnMoney" ? formatMoney(def.target) : tostring(def.target);
	if (def.kind === "mineOre" && def.ore !== undefined) {
		return t("quest.mineOreOf", { target, ore: t(nameKeys.ore(def.ore)) });
	}
	if (def.kind === "gear") {
		return t("quest.gear", { gear: def.gear !== undefined ? t(nameKeys.gear(def.gear)) : "?" });
	}
	return t(`quest.${def.kind}` as StringKey, { target });
}

function rewardText(reward: QuestReward): string {
	const parts: string[] = [];
	if (reward.money !== undefined && reward.money > 0) {
		parts.push(formatMoney(reward.money));
	}
	if (reward.crystals !== undefined && reward.crystals > 0) {
		parts.push(`${reward.crystals} 💎`);
	}
	return parts.join("  +  ");
}

function QuestCard(props: { def: QuestDef; progress: number; claimed: boolean; onClaim: () => void; order: number }) {
	const done = props.progress >= props.def.target;
	const shown = math.min(props.progress, props.def.target);
	const progressText =
		props.def.kind === "earnMoney"
			? `${formatMoney(shown)} / ${formatMoney(props.def.target)}`
			: `${math.floor(shown)} / ${props.def.target}`;
	return (
		<Card gap={6} order={props.order} accent={done && !props.claimed ? COLORS.gold : undefined}>
			<Label text={questText(props.def)} display={true} size={TEXT_SIZES.body} order={1} />
			<ProgressBar
				progress={props.def.target > 0 ? shown / props.def.target : 0}
				text={progressText}
				height={20}
				order={2}
			/>
			<Label text={rewardText(props.def.reward)} tone="gold" size={TEXT_SIZES.small} order={3} />
			{props.claimed ? (
				<Label text={t("quests.claimedLabel")} tone="success" display={true} order={4} />
			) : (
				<Button
					text={t("quests.claim")}
					variant={done ? "primary" : "secondary"}
					disabled={!done}
					onClick={props.onClaim}
					height={40}
					shine={done}
					order={4}
				/>
			)}
		</Card>
	);
}

function StreakCard(props: { view: PlayerView; order: number }) {
	const quests = props.view.quests;
	const today = dayOf(os.time());
	const claimable = quests.loginDay === today && quests.streakClaimedDay !== today && quests.streak >= 1;
	return (
		<Card gap={6} order={props.order} accent={claimable ? COLORS.gold : undefined}>
			<Label text={t("quests.streak", { day: math.max(quests.streak, 1) })} display={true} order={1} />
			<Label text={rewardText(streakReward(quests.streak))} tone="gold" size={TEXT_SIZES.small} order={2} />
			{claimable ? (
				<Button
					text={t("quests.claim")}
					variant="primary"
					shine={true}
					height={40}
					onClick={() => sendToServer(CLAIM_QUEST_REMOTE, "streak")}
					order={3}
				/>
			) : (
				<Label text={t("quests.claimedLabel")} tone="success" order={3} />
			)}
		</Card>
	);
}

function QuestsList(props: { view: PlayerView }) {
	const view = props.view;
	const snapshot = snapshotOf(view);
	const quests = view.quests;
	const elements: React.Element[] = [<StreakCard key="streak" view={view} order={1} />];
	elements.push(<Label key="dailyTitle" text={t("quests.daily")} display={true} order={2} />);
	quests.daily.forEach((entry, index) => {
		const base = findDaily(entry.id);
		if (base === undefined) {
			return;
		}
		const def = scaledDaily(base, view.deepestLayer);
		elements.push(
			<QuestCard
				key={`daily_${index}`}
				def={def}
				progress={questProgress(def, entry.count, snapshot)}
				claimed={entry.claimed}
				onClaim={() => sendToServer(CLAIM_QUEST_REMOTE, "daily", index)}
				order={3 + index}
			/>,
		);
	});
	const allClaimed = quests.daily.size() > 0 && quests.daily.every((entry) => entry.claimed);
	if (allClaimed && !quests.allDoneClaimed) {
		elements.push(
			<Button
				key="allDone"
				text={t("quests.allDone", { crystals: DAILY_ALL_DONE_REWARD.crystals ?? 0 })}
				variant="primary"
				shine={true}
				onClick={() => sendToServer(CLAIM_QUEST_REMOTE, "allDone")}
				order={10}
			/>,
		);
	}
	elements.push(<Label key="chainTitle" text={t("quests.chain")} display={true} order={11} />);
	const active = CHAIN_QUESTS[quests.chain];
	if (active === undefined) {
		elements.push(<Label key="chainDone" text={t("quests.chainDone")} tone="muted" order={12} />);
	} else {
		elements.push(
			<Label
				key="chainStep"
				text={`${quests.chain + 1} / ${CHAIN_QUESTS.size()}`}
				tone="muted"
				size={TEXT_SIZES.small}
				order={12}
			/>,
		);
		elements.push(
			<QuestCard
				key="chain"
				def={active}
				progress={questProgress(active, quests.chainCount, snapshot)}
				claimed={false}
				onClaim={() => sendToServer(CLAIM_QUEST_REMOTE, "chain")}
				order={13}
			/>,
		);
		// A story step can be skipped (without its reward), e.g. after buying better gear in the store.
		elements.push(
			<Button
				key="chainSkip"
				text={t("quests.skip")}
				variant="slate"
				height={34}
				onClick={() => sendToServer(CLAIM_QUEST_REMOTE, "skip")}
				order={14}
			/>,
		);
	}
	return <>{elements}</>;
}

export function QuestsPanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	return <QuestsList view={view} />;
}
