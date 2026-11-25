import type { BoardId } from "./leaderboard";

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
