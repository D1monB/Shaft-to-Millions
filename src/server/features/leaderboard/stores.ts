// The two LeaderboardStore implementations: OrderedDataStore on live servers, memory in Studio.
import { DataStoreService } from "@rbxts/services";
import { BoardId, higherScore } from "shared/features/leaderboard";
import { LeaderboardStore } from "./ports";

// Changing a name starts that board from zero. Bump the version only on purpose (e.g. a new score formula).
const STORE_NAMES: { readonly [K in BoardId]: string } = {
	depth: "Leaderboard_Depth_v1",
	wealth: "Leaderboard_Wealth_v1",
};

/**
 * The real boards. UpdateAsync keeps the higher score, so two servers writing at once can never lower it.
 * Only the server writes, and only scores it computed from the profile.
 */
export function createOrderedStore(): LeaderboardStore {
	const stores = {
		depth: DataStoreService.GetOrderedDataStore(STORE_NAMES.depth),
		wealth: DataStoreService.GetOrderedDataStore(STORE_NAMES.wealth),
	};
	return {
		raiseScore: (board, userId, score) => {
			stores[board].UpdateAsync(tostring(userId), (stored) => higherScore(stored, score));
		},
		top: (board, count) => {
			const page = stores[board].GetSortedAsync(false, count).GetCurrentPage();
			return page.map((entry) => ({ key: entry.key, value: entry.value }));
		},
	};
}

/**
 * Studio boards: kept in memory for this Play session only.
 * Why: Studio play-tests use dev money (devtools), and with API access on they would write fake records into
 * the real boards. This way the real boards only ever see live servers.
 */
export function createMemoryStore(): LeaderboardStore {
	const boards: { [K in BoardId]: Map<number, number> } = { depth: new Map(), wealth: new Map() };
	return {
		raiseScore: (board, userId, score) => {
			boards[board].set(userId, higherScore(boards[board].get(userId), score));
		},
		top: (board, count) => {
			const rows: Array<{ key: string; value: number }> = [];
			boards[board].forEach((value, userId) => rows.push({ key: tostring(userId), value }));
			rows.sort((a, b) => a.value > b.value);
			const top: Array<{ key: string; value: number }> = [];
			for (const row of rows) {
				if (top.size() >= count) {
					break;
				}
				top.push(row);
			}
			return top;
		},
	};
}
