import { Assert, Test } from "@rbxts/lunit";
import { parseSnapshot } from "./network";
import { LEADERBOARD_SIZE } from "./tuning";

class LeaderboardSnapshotTests {
	@Test
	public validSnapshotIsKept() {
		const snapshot = parseSnapshot({
			depth: [{ rank: 1, userId: 10, name: "miner", score: 200_050 }],
			wealth: [],
		});
		Assert.equal(snapshot.depth.size(), 1);
		Assert.equal(snapshot.depth[0].name, "miner");
		Assert.equal(snapshot.depth[0].score, 200_050);
		Assert.equal(snapshot.wealth.size(), 0);
	}

	@Test
	public notATableGivesEmptyBoards() {
		for (const raw of [undefined, 5, "x", true]) {
			const snapshot = parseSnapshot(raw);
			Assert.equal(snapshot.depth.size(), 0);
			Assert.equal(snapshot.wealth.size(), 0);
		}
	}

	@Test
	public brokenRowsAreSkippedAndRanksRenumbered() {
		const snapshot = parseSnapshot({
			wealth: [
				{ userId: 0 / 0, name: "a", score: 5 },
				{ userId: 1, name: 5, score: 5 },
				{ userId: 2, name: "b", score: math.huge },
				{ userId: 3, name: "c", score: -1 },
				{ userId: 4.5, name: "d", score: 5 },
				"junk",
				{ userId: 6, name: "ok", score: 50 },
			],
			depth: "junk",
		});
		Assert.equal(snapshot.wealth.size(), 1);
		Assert.equal(snapshot.wealth[0].userId, 6);
		Assert.equal(snapshot.wealth[0].rank, 1);
		Assert.equal(snapshot.depth.size(), 0);
	}

	@Test
	public tooManyRowsAndLongNamesAreCut() {
		const rows: Array<{ userId: number; name: string; score: number }> = [];
		for (let i = 1; i <= LEADERBOARD_SIZE * 3; i++) {
			rows.push({ userId: i, name: string.rep("x", 500), score: 100 });
		}
		const snapshot = parseSnapshot({ depth: rows, wealth: [] });
		Assert.equal(snapshot.depth.size(), LEADERBOARD_SIZE);
		Assert.true(snapshot.depth[0].name.size() <= 40);
	}
}

export = LeaderboardSnapshotTests;
