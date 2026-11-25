import type { BoardId } from "./leaderboard";
import { LEADERBOARD_SIZE } from "./tuning";

/** Server -> client: the latest LeaderboardSnapshot. The client never sends anything for the leaderboard. */
export const LEADERBOARD_REMOTE = "LeaderboardUpdate";

/** One row as the client shows it. `name` is the public Roblox user name, nothing else about the player. */
export interface LeaderboardRow {
	readonly rank: number;
	readonly userId: number;
	readonly name: string;
	readonly score: number;
}

export type LeaderboardSnapshot = { readonly [K in BoardId]: ReadonlyArray<LeaderboardRow> };

const MAX_NAME_LENGTH = 40;

function parseRow(raw: unknown, rank: number): LeaderboardRow | undefined {
	if (!typeIs(raw, "table")) {
		return undefined;
	}
	const { userId, name, score } = raw as { userId?: unknown; name?: unknown; score?: unknown };
	const isCount = (value: unknown): value is number =>
		typeIs(value, "number") && value === value && value > 0 && value < math.huge && math.floor(value) === value;
	if (!isCount(userId) || !isCount(score) || !typeIs(name, "string")) {
		return undefined;
	}
	return { rank, userId, name: name.sub(1, MAX_NAME_LENGTH), score };
}

function parseBoard(raw: unknown): LeaderboardRow[] {
	if (!typeIs(raw, "table")) {
		return [];
	}
	const rows: LeaderboardRow[] = [];
	for (const entry of raw as unknown[]) {
		if (rows.size() >= LEADERBOARD_SIZE) {
			break;
		}
		const row = parseRow(entry, rows.size() + 1);
		if (row !== undefined) {
			rows.push(row);
		}
	}
	return rows;
}

/**
 * The client's check of a snapshot. The server sends it, but the UI must never crash on a malformed message
 * (an old server during an update, a bug), so anything broken becomes an empty or shorter board.
 * Ranks are renumbered from the order received.
 */
export function parseSnapshot(raw: unknown): LeaderboardSnapshot {
	if (!typeIs(raw, "table")) {
		return { depth: [], wealth: [] };
	}
	const { depth, wealth } = raw as { depth?: unknown; wealth?: unknown };
	return { depth: parseBoard(depth), wealth: parseBoard(wealth) };
}
