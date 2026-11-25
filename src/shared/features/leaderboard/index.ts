// leaderboard feature (shared): depth and wealth boards, the stored scores and clean rows. Pure logic, no Roblox API.
// Public API of this feature. Other code imports only from this file.
export {
	BOARD_IDS,
	cleanRows,
	decodeDepthScore,
	depthMeters,
	depthScore,
	higherScore,
	recordDepth,
	shouldWrite,
	wealthScore,
} from "./leaderboard";
export type { BoardId, BoardRow, DepthRecord } from "./leaderboard";
export { LEADERBOARD_SIZE, SYNC_INTERVAL } from "./tuning";
export { LEADERBOARD_REMOTE, parseSnapshot } from "./network";
export type { LeaderboardRow, LeaderboardSnapshot } from "./network";
