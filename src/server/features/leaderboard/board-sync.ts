// The leaderboard sync without Roblox: which scores to write, and turning stored rows into what clients see.
// Storage failures are expected (DataStore budget, outages): they are caught here and never break the game.
import {
	BOARD_IDS,
	BoardId,
	LEADERBOARD_SIZE,
	LeaderboardRow,
	LeaderboardSnapshot,
	cleanRows,
	shouldWrite,
} from "shared/features/leaderboard";
import { LeaderboardStore, NameLookup } from "./ports";

export type Scores = { readonly [K in BoardId]: number };

/** Last score written per board and user, so an unchanged score never spends DataStore budget. */
export class WrittenScores {
	private readonly written = new Map<string, number>();

	public get(board: BoardId, userId: number): number | undefined {
		return this.written.get(`${board}:${userId}`);
	}

	public set(board: BoardId, userId: number, score: number): void {
		this.written.set(`${board}:${userId}`, score);
	}
}

/**
 * Writes every board score of one user that grew since the last successful write.
 * A failed write is retried on the next round (the score is only remembered after success).
 * Returns how many writes failed.
 */
export function writeScores(store: LeaderboardStore, written: WrittenScores, userId: number, scores: Scores): number {
	let failed = 0;
	for (const board of BOARD_IDS) {
		const score = scores[board];
		if (!shouldWrite(written.get(board, userId), score)) {
			continue;
		}
		const [ok] = pcall(() => store.raiseScore(board, userId, score));
		if (ok) {
			written.set(board, userId, score);
		} else {
			failed += 1;
		}
	}
	return failed;
}

/** Caches names: a name lookup is a web call, and the same players stay on the board for a long time. */
export class NameCache {
	private readonly names = new Map<number, string>();

	public constructor(
		private readonly lookup: NameLookup,
		private readonly fallback: string,
	) {}

	public nameOf(userId: number): string {
		const cached = this.names.get(userId);
		if (cached !== undefined) {
			return cached;
		}
		const [ok, name] = pcall(() => this.lookup(userId));
		if (ok && typeIs(name, "string") && name.size() > 0) {
			this.names.set(userId, name);
			return name;
		}
		// Not cached: a lookup that failed now may work on the next round.
		return this.fallback;
	}
}

/**
 * Reads the top rows of every board. A board that fails to read keeps its previous rows,
 * so one DataStore hiccup does not empty the board on every screen.
 */
export function readBoards(
	store: LeaderboardStore,
	names: NameCache,
	previous: LeaderboardSnapshot,
): LeaderboardSnapshot {
	const result: { [K in BoardId]: ReadonlyArray<LeaderboardRow> } = {
		depth: previous.depth,
		wealth: previous.wealth,
	};
	for (const board of BOARD_IDS) {
		const [ok, raw] = pcall(() => store.top(board, LEADERBOARD_SIZE));
		if (!ok) {
			continue;
		}
		result[board] = cleanRows(raw).map((row, index) => ({
			rank: index + 1,
			userId: row.userId,
			name: names.nameOf(row.userId),
			score: row.score,
		}));
	}
	return result;
}

export function emptySnapshot(): LeaderboardSnapshot {
	return { depth: [], wealth: [] };
}
