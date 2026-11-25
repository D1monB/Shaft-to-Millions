// Leaderboard panel: the top players by depth and by lifetime earnings. Read-only: the server sends the rows,
// the client never sends anything for the leaderboard.
import React, { useState } from "@rbxts/react";
import { Players } from "@rbxts/services";
import { nameKeys } from "shared/features/i18n";
import { t } from "client/lib/i18n";
import {
	BoardId,
	LeaderboardRow,
	LeaderboardSnapshot,
	LEADERBOARD_REMOTE,
	decodeDepthScore,
	depthScore,
	parseSnapshot,
	wealthScore,
} from "shared/features/leaderboard";
import { formatMoney } from "shared/lib/format";
import { registerHudButton } from "client/features/hud";
import { useView } from "client/features/profile";
import { openPanel } from "client/lib/panels";
import { onServerMessage } from "client/lib/remotes";
import { Store, useStore } from "client/lib/store";
import { COLORS, Label, RADIUS, STROKE, Stack, TEXT_SIZES, Tabs } from "client/lib/ui-kit";

const snapshotStore = new Store<LeaderboardSnapshot>({ depth: [], wealth: [] });

const MEDALS: { readonly [rank: number]: string | undefined } = { 1: "🥇", 2: "🥈", 3: "🥉" };
const ROW_HEIGHT = 40;

function depthText(score: number): string {
	const record = decodeDepthScore(score);
	return t("board.depth", { layer: t(nameKeys.layer(record.layer)), meters: record.meters });
}

function scoreText(board: BoardId, score: number): string {
	return board === "depth" ? depthText(score) : formatMoney(score);
}

function Row(props: { board: BoardId; row: LeaderboardRow; mine: boolean }) {
	const { row } = props;
	return (
		<frame
			BackgroundColor3={props.mine ? COLORS.gold : COLORS.well}
			BackgroundTransparency={props.mine ? 0.55 : 0.2}
			Size={new UDim2(1, 0, 0, ROW_HEIGHT)}
			LayoutOrder={row.rank}
		>
			<uicorner CornerRadius={RADIUS.small} />
			<uistroke Color={COLORS.outline} Thickness={STROKE.thin} />
			<uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} />
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				SortOrder={Enum.SortOrder.LayoutOrder}
				Padding={new UDim(0, 8)}
			/>
			<Label text={MEDALS[row.rank] ?? `${row.rank}.`} display truncate width={new UDim(0, 40)} order={1} />
			{/* Truncated, not wrapped: the row has a fixed height, a second line would cover the next row. */}
			<Label text={row.name} bold truncate width={new UDim(0.45, -32)} order={2} />
			<Label
				text={scoreText(props.board, row.score)}
				tone="gold"
				display
				truncate
				align="right"
				width={new UDim(0.55, -32)}
				order={3}
			/>
		</frame>
	);
}

function MyRecord(props: { board: BoardId; order: number }) {
	const view = useView();
	if (view === undefined) {
		return undefined;
	}
	const text =
		props.board === "depth"
			? t("board.myRecord", { depth: depthText(depthScore(view.deepestLayer, view.deepestMeters)) })
			: t("board.myWealth", { money: formatMoney(wealthScore(view.stats.totalEarned)) });
	return <Label text={text} tone="muted" order={props.order} />;
}

function LeaderboardPanel() {
	const snapshot = useStore(snapshotStore);
	const [board, setBoard] = useState<BoardId>("depth");
	const rows = snapshot[board];
	const me = Players.LocalPlayer.UserId;
	return (
		<>
			<Tabs
				items={[
					{ key: "depth", label: t("board.tab.depth") },
					{ key: "wealth", label: t("board.tab.wealth") },
				]}
				selected={board}
				onSelect={(key) => setBoard(key === "wealth" ? "wealth" : "depth")}
				order={1}
			/>
			<Stack gap={6} order={2}>
				{rows.map((row) => (
					<Row key={`row_${row.rank}`} board={board} row={row} mine={row.userId === me} />
				))}
			</Stack>
			{rows.size() === 0 && <Label text={t("board.empty")} tone="muted" order={3} />}
			<MyRecord board={board} order={4} />
			<Label text={t("board.refresh")} tone="muted" size={TEXT_SIZES.small} order={5} />
		</>
	);
}

export function startLeaderboardController(): void {
	onServerMessage(LEADERBOARD_REMOTE, (raw) => snapshotStore.set(parseSnapshot(raw)));
	registerHudButton(
		"🏆",
		() => t("menu.top"),
		() =>
			openPanel({ key: "leaderboard", title: t("board.title"), icon: "🏆", render: () => <LeaderboardPanel /> }),
		30,
		"primary",
	);
}
