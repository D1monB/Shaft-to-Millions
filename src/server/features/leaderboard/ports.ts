import type { BoardId } from "shared/features/leaderboard";

// The leaderboard talks to storage and the name lookup only through these ports.
// Why: the real ones need Roblox (OrderedDataStore, Players), the sync logic does not, so it is tested headless.
// Every method may throw (DataStore errors); the caller wraps calls in pcall.

export interface LeaderboardStore {
	/** Raises the stored score of the user to `score` if it is higher. Never lowers it. */
	readonly raiseScore: (board: BoardId, userId: number, score: number) => void;
	/** The top `count` rows as raw `{ key, value }` entries, best first. Not trusted: cleanRows checks them. */
	readonly top: (board: BoardId, count: number) => unknown;
}

/** The public user name for a user id. May throw or yield. */
export type NameLookup = (userId: number) => string;
