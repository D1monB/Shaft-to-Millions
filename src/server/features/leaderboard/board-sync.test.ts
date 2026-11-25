import { Assert, Test } from "@rbxts/lunit";
import { BoardId, LEADERBOARD_SIZE, higherScore } from "shared/features/leaderboard";
import { NameCache, WrittenScores, emptySnapshot, readBoards, writeScores } from "./board-sync";
import { LeaderboardStore } from "./ports";

interface FakeStore extends LeaderboardStore {
	readonly scores: { [K in BoardId]: Map<number, number> };
	writes: number;
	failWrites: boolean;
	failReads: boolean;
	rawTop?: unknown;
}

function fakeStore(): FakeStore {
	const store: FakeStore = {
		scores: { depth: new Map(), wealth: new Map() },
		writes: 0,
		failWrites: false,
		failReads: false,
		raiseScore: (board, userId, score) => {
			if (store.failWrites) {
				error("DataStore budget exhausted");
			}
			store.writes += 1;
			store.scores[board].set(userId, higherScore(store.scores[board].get(userId), score));
		},
		top: (board) => {
			if (store.failReads) {
				error("DataStore down");
			}
			if (store.rawTop !== undefined) {
				return store.rawTop;
			}
			const rows: Array<{ key: string; value: number }> = [];
			store.scores[board].forEach((value, userId) => rows.push({ key: tostring(userId), value }));
			return rows;
		},
	};
	return store;
}

const names = () => new NameCache((userId) => `user${userId}`, "Гравець");

class BoardSyncTests {
	@Test
	public writesOnlyGrownScores() {
		const store = fakeStore();
		const written = new WrittenScores();
		writeScores(store, written, 1, { depth: 100_010, wealth: 500 });
		Assert.equal(store.writes, 2);
		// Same scores again: no DataStore budget spent.
		writeScores(store, written, 1, { depth: 100_010, wealth: 500 });
		Assert.equal(store.writes, 2);
		// Only wealth grew.
		writeScores(store, written, 1, { depth: 100_010, wealth: 900 });
		Assert.equal(store.writes, 3);
		Assert.equal(store.scores.wealth.get(1), 900);
	}

	@Test
	public zeroAndBrokenScoresAreNeverWritten() {
		const store = fakeStore();
		writeScores(store, new WrittenScores(), 1, { depth: 0, wealth: 0 / 0 });
		writeScores(store, new WrittenScores(), 2, { depth: math.huge, wealth: -5 });
		Assert.equal(store.writes, 0);
	}

	@Test
	public storeNeverLowersAScore() {
		const store = fakeStore();
		// Another server already wrote a higher score for this user.
		store.scores.wealth.set(1, 10_000);
		writeScores(store, new WrittenScores(), 1, { depth: 0, wealth: 300 });
		Assert.equal(store.scores.wealth.get(1), 10_000);
	}

	@Test
	public failedWriteIsRetriedNextRound() {
		const store = fakeStore();
		const written = new WrittenScores();
		store.failWrites = true;
		Assert.equal(writeScores(store, written, 1, { depth: 100_005, wealth: 50 }), 2);
		store.failWrites = false;
		Assert.equal(writeScores(store, written, 1, { depth: 100_005, wealth: 50 }), 0);
		Assert.equal(store.scores.depth.get(1), 100_005);
	}

	@Test
	public readsRankedRowsWithNames() {
		const store = fakeStore();
		for (let id = 1; id <= LEADERBOARD_SIZE + 3; id++) {
			store.scores.wealth.set(id, id * 100);
		}
		const snapshot = readBoards(store, names(), emptySnapshot());
		Assert.equal(snapshot.wealth.size(), LEADERBOARD_SIZE);
		Assert.equal(snapshot.wealth[0].rank, 1);
		Assert.equal(snapshot.wealth[0].userId, LEADERBOARD_SIZE + 3);
		Assert.equal(snapshot.wealth[0].name, `user${LEADERBOARD_SIZE + 3}`);
		Assert.equal(snapshot.depth.size(), 0);
	}

	@Test
	public failedReadKeepsThePreviousRows() {
		const store = fakeStore();
		store.scores.depth.set(7, 100_050);
		const first = readBoards(store, names(), emptySnapshot());
		store.failReads = true;
		const second = readBoards(store, names(), first);
		Assert.equal(second.depth.size(), 1);
		Assert.equal(second.depth[0].userId, 7);
	}

	@Test
	public corruptedStoreRowsAreDropped() {
		const store = fakeStore();
		store.rawTop = [{ key: "abc", value: 5 }, { key: "3", value: 0 / 0 }, "junk", { key: "4", value: 40 }];
		const snapshot = readBoards(store, names(), emptySnapshot());
		Assert.equal(snapshot.depth.size(), 1);
		Assert.equal(snapshot.depth[0].userId, 4);
	}

	@Test
	public nameLookupFailureUsesFallbackAndRetries() {
		let calls = 0;
		let broken = true;
		const cache = new NameCache((userId) => {
			calls += 1;
			if (broken) {
				error("web call failed");
			}
			return `user${userId}`;
		}, "Гравець");
		Assert.equal(cache.nameOf(5), "Гравець");
		broken = false;
		Assert.equal(cache.nameOf(5), "user5");
		// Cached now: no second web call.
		Assert.equal(cache.nameOf(5), "user5");
		Assert.equal(calls, 2);
	}

	@Test
	public emptyNameUsesFallback() {
		const cache = new NameCache(() => "", "Гравець");
		Assert.equal(cache.nameOf(1), "Гравець");
	}
}

export = BoardSyncTests;
