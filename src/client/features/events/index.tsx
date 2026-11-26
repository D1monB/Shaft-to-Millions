// events feature (client): the raid panel with this week's top, a live raid tile and the cave-in-safe dock entry
// (decision 065). Everything shown comes from the server: attributes while a raid runs, the top from RaidTop.
import React, { useEffect, useState } from "@rbxts/react";
import { Players } from "@rbxts/services";
import { RAID_COOLDOWN_SECONDS, RAID_SECONDS } from "shared/config/events";
import {
	RAID_ENDS_ATTRIBUTE,
	RAID_SCORE_ATTRIBUTE,
	RAID_TOP_REMOTE,
	RaidRow,
	START_RAID_REMOTE,
	raidCooldownLeft,
	weekOf,
} from "shared/features/events";
import { formatDuration, formatMoney } from "shared/lib/format";
import { registerHudButton } from "client/features/hud";
import { useView } from "client/features/profile";
import { useServerClock } from "client/lib/hooks";
import { t } from "client/lib/i18n";
import { openPanel } from "client/lib/panels";
import { onServerMessage, sendToServer } from "client/lib/remotes";
import { Button, Card, Label, ProgressBar, TEXT_SIZES } from "client/lib/ui-kit";

let top: RaidRow[] = [];

function readRaid(player: Player): { endsAt: number; score: number } | undefined {
	const endsAt = player.GetAttribute(RAID_ENDS_ATTRIBUTE);
	const score = player.GetAttribute(RAID_SCORE_ATTRIBUTE);
	return typeIs(endsAt, "number") ? { endsAt, score: typeIs(score, "number") ? score : 0 } : undefined;
}

/** The running raid from the server-set attributes, if one runs now. */
function useRaidRun(now: number): { left: number; score: number } | undefined {
	const player = Players.LocalPlayer;
	const [state, setState] = useState(() => readRaid(player));
	useEffect(() => {
		const connections = [RAID_ENDS_ATTRIBUTE, RAID_SCORE_ATTRIBUTE].map((name) =>
			player.GetAttributeChangedSignal(name).Connect(() => setState(readRaid(player))),
		);
		return () => {
			for (const connection of connections) {
				connection.Disconnect();
			}
		};
	}, [player]);
	return state === undefined ? undefined : { left: math.max(0, state.endsAt - now), score: state.score };
}

function parseRows(value: unknown): RaidRow[] {
	const rows: RaidRow[] = [];
	if (typeIs(value, "table")) {
		for (const entry of value as unknown[]) {
			const row = entry as Partial<RaidRow>;
			if (typeIs(entry, "table") && typeIs(row.name, "string") && typeIs(row.score, "number")) {
				rows.push({ name: row.name, score: row.score });
			}
		}
	}
	return rows;
}

function RaidPanel() {
	const view = useView();
	const now = useServerClock(1);
	const run = useRaidRun(now);
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	const cooldown = raidCooldownLeft(view.raid, now);
	const best = view.raid.week === weekOf(now) ? view.raid.best : 0;
	return (
		<>
			<Card order={1} gap={6}>
				<Label text={t("events.raidInfo", { seconds: RAID_SECONDS })} order={1} />
				<Label text={t("events.raidYourBest", { score: formatMoney(best) })} tone="gold" order={2} />
				{run !== undefined ? (
					<>
						<Label
							text={t("events.raidRunning", { score: formatMoney(run.score) })}
							display={true}
							size={TEXT_SIZES.large}
							tone="success"
							order={3}
						/>
						<ProgressBar
							progress={run.left / RAID_SECONDS}
							text={formatDuration(run.left)}
							height={22}
							order={4}
						/>
					</>
				) : (
					<Button
						text={
							cooldown > 0
								? t("events.raidAgain", { time: formatDuration(cooldown) })
								: t("events.raidStart")
						}
						variant="primary"
						shine={cooldown <= 0}
						disabled={cooldown > 0}
						height={52}
						onClick={() => sendToServer(START_RAID_REMOTE)}
						order={3}
					/>
				)}
				<Label
					text={t("events.raidCooldown", { minutes: RAID_COOLDOWN_SECONDS / 60 })}
					tone="muted"
					size={TEXT_SIZES.small}
					order={5}
				/>
			</Card>
			<Card order={2} gap={3}>
				<Label text={t("events.raidTop")} display={true} order={0} />
				{top.size() === 0 && <Label text={t("events.raidTopEmpty")} tone="muted" order={1} />}
				{top.map((row, index) => (
					<Label
						key={`row_${index}`}
						text={`${index + 1}. ${row.name}  —  ${formatMoney(row.score)}`}
						tone={index === 0 ? "gold" : "normal"}
						order={index + 1}
					/>
				))}
			</Card>
		</>
	);
}

export function startEventsController(): void {
	onServerMessage(RAID_TOP_REMOTE, (rows) => {
		top = parseRows(rows);
	});
	registerHudButton(
		"⏱",
		() => t("menu.raid"),
		() => openPanel({ key: "raid", title: t("events.raidTitle"), icon: "⏱", render: () => <RaidPanel /> }),
		10,
		"primary",
	);
}
