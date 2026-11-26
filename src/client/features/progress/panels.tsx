// The calendar, rebirth and titles panels (decision 070). Buttons only ask; the server checks and pays.
import React, { useState } from "@rbxts/react";
import { CALENDAR_DAYS } from "shared/config/retention";
import { StringKey } from "shared/config/i18n";
import {
	ACHIEVEMENTS,
	CLAIM_CALENDAR_REMOTE,
	REBIRTH_REMOTE,
	REBIRTH_REWARD_CRYSTALS,
	SET_TITLE_REMOTE,
	calendarReward,
	canClaimCalendar,
	isUnlocked,
	rebirthMultiplier,
	rebirthPrice,
	statsOfProfile,
} from "shared/features/progress";
import { dayOf } from "shared/features/quests";
import { formatCompact, formatMoney } from "shared/lib/format";
import { useView } from "client/features/profile";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";
import { Button, COLORS, Card, Label, ProgressBar, TEXT_SIZES } from "client/lib/ui-kit";

function rewardLine(day: number, layer: number): string {
	const reward = calendarReward(day, layer);
	const parts: string[] = [`${reward.crystals} 💎`];
	if (reward.money > 0) {
		parts.push(formatMoney(reward.money));
	}
	if (reward.boosters.size() > 0) {
		parts.push("⚡");
	}
	return parts.join(" + ");
}

export function CalendarPanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	const open = canClaimCalendar(view.calendar, dayOf(os.time()));
	const nextDay = view.calendar.claimed + 1;
	const days: number[] = [];
	for (let day = nextDay; day <= math.min(nextDay + 6, CALENDAR_DAYS); day++) {
		days.push(day);
	}
	if (!days.includes(CALENDAR_DAYS)) {
		days.push(CALENDAR_DAYS);
	}
	return (
		<>
			<ProgressBar
				progress={view.calendar.claimed / CALENDAR_DAYS}
				text={`${view.calendar.claimed} / ${CALENDAR_DAYS}`}
				height={22}
				order={1}
			/>
			<Button
				text={open ? t("calendar.claim", { day: nextDay }) : t("calendar.tomorrow")}
				variant="primary"
				shine={open}
				disabled={!open}
				height={52}
				onClick={() => sendToServer(CLAIM_CALENDAR_REMOTE)}
				order={2}
			/>
			{days.map((day, index) => (
				<Card key={day} order={3 + index} accent={day === nextDay ? COLORS.gold : undefined} gap={2}>
					<Label text={t("calendar.day", { day })} display={true} order={1} />
					<Label
						text={rewardLine(day, view.deepestLayer)}
						tone={day === CALENDAR_DAYS ? "gold" : "muted"}
						size={TEXT_SIZES.small}
						order={2}
					/>
				</Card>
			))}
		</>
	);
}

export function RebirthPanel() {
	const view = useView();
	const [armed, setArmed] = useState(false);
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	const price = rebirthPrice(view.rebirths);
	return (
		<>
			<Card order={1} gap={6}>
				<Label
					text={t("rebirth.now", { count: view.rebirths, value: rebirthMultiplier(view.rebirths) })}
					display={true}
					order={1}
				/>
				<Label text={t("rebirth.info", { crystals: REBIRTH_REWARD_CRYSTALS })} tone="muted" order={2} />
				{price !== undefined ? (
					<>
						<Label
							text={t("rebirth.next", { value: rebirthMultiplier(view.rebirths + 1) })}
							tone="success"
							order={3}
						/>
						<ProgressBar
							progress={view.money / price}
							text={`${formatMoney(view.money)} / ${formatMoney(price)}`}
							height={22}
							order={4}
						/>
					</>
				) : (
					<Label text={t("line.maxed")} tone="success" order={3} />
				)}
			</Card>
			{price !== undefined && (
				<Button
					text={armed ? t("admin.confirm") : t("rebirth.button")}
					variant="danger"
					disabled={view.money < price}
					height={52}
					onClick={() => {
						if (armed) {
							sendToServer(REBIRTH_REMOTE);
							setArmed(false);
						} else {
							setArmed(true);
						}
					}}
					order={2}
				/>
			)}
		</>
	);
}

export function TitlesPanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	const stats = statsOfProfile(view);
	return (
		<>
			{ACHIEVEMENTS.map((def, index) => {
				const unlocked = isUnlocked(def, stats);
				const chosen = view.title === def.id;
				const color = Color3.fromRGB(def.color[0], def.color[1], def.color[2]);
				return (
					<Card key={def.id} order={index} accent={unlocked ? color : undefined} gap={4}>
						<Label
							text={t(`title.${def.id}` as StringKey)}
							display={true}
							color={unlocked ? color : undefined}
							order={1}
						/>
						<Label
							text={t(`title.goal.${def.metric}` as StringKey, { value: formatCompact(def.target) })}
							tone="muted"
							size={TEXT_SIZES.small}
							order={2}
						/>
						{unlocked ? (
							<Button
								text={chosen ? t("title.hide") : t("title.wear")}
								variant={chosen ? "slate" : "success"}
								height={34}
								onClick={() => sendToServer(SET_TITLE_REMOTE, chosen ? "" : def.id)}
								order={3}
							/>
						) : (
							<ProgressBar
								progress={stats[def.metric] / def.target}
								text={`${formatCompact(math.min(stats[def.metric], def.target))} / ${formatCompact(def.target)}`}
								height={16}
								order={3}
							/>
						)}
					</Card>
				);
			})}
		</>
	);
}
