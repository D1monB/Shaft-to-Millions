import { Assert, Test } from "@rbxts/lunit";
import { LAYER_COUNT, MAX_DEPTH_METERS } from "shared/config/layers";
import { MAX_COUNTER } from "shared/lib/repair";
import {
	cleanRows,
	decodeDepthScore,
	depthLimit,
	depthMeters,
	depthScore,
	higherScore,
	recordDepth,
	shouldWrite,
	wealthScore,
} from "./leaderboard";
import { DEPTH_LAYER_FACTOR, LEADERBOARD_SIZE, METERS_PER_STUD } from "./tuning";

const NAN = 0 / 0;

class LeaderboardTests {
	@Test
	public layerFactorLeavesRoomForEveryDepth() {
		Assert.true(DEPTH_LAYER_FACTOR > MAX_DEPTH_METERS);
		// The biggest score must stay an exact integer in a double.
		Assert.true(depthScore(LAYER_COUNT, MAX_DEPTH_METERS) < 2 ** 53);
	}

	@Test
	public depthIsMetersBelowTheSurface() {
		Assert.equal(depthMeters(100, 100), 0);
		Assert.equal(depthMeters(100, 0), math.floor(100 * METERS_PER_STUD));
		// Above the surface is not negative depth.
		Assert.equal(depthMeters(100, 500), 0);
	}

	@Test
	public depthRejectsBrokenInput() {
		Assert.equal(depthMeters(NAN, 0), 0);
		Assert.equal(depthMeters(0, NAN), 0);
		Assert.equal(depthMeters(0, -math.huge), 0);
		Assert.equal(depthMeters(math.huge, 0), 0);
		Assert.equal(depthMeters("100" as unknown as number, 0), 0);
		// Falling through the world is capped, not a record of a million meters.
		Assert.equal(depthMeters(0, -1e12), MAX_DEPTH_METERS);
	}

	@Test
	public recordOnlyGrows() {
		Assert.equal(recordDepth(10, 25, 1000), 25);
		Assert.undefined(recordDepth(25, 10, 1000));
		Assert.undefined(recordDepth(25, 25, 1000));
	}

	@Test
	public recordIsCappedByTheLockedCamp() {
		Assert.equal(recordDepth(0, 500, 120), 120);
		Assert.undefined(recordDepth(120, 500, 120));
		// No cap (last layer opened) still stops at the global limit.
		Assert.equal(recordDepth(0, 1e9, math.huge), MAX_DEPTH_METERS);
		Assert.equal(recordDepth(0, 50, NAN), 50);
	}

	@Test
	public recordRejectsBrokenSamples() {
		Assert.undefined(recordDepth(0, NAN, 100));
		Assert.undefined(recordDepth(0, math.huge, 100));
		Assert.undefined(recordDepth(NAN, 10, 100));
		Assert.undefined(recordDepth(0, -5, 100));
	}

	@Test
	public missingCampMeansNoRecord() {
		// Regression (exploit review): a missing camp used to remove the cap entirely.
		Assert.undefined(depthLimit(1, undefined));
		Assert.undefined(depthLimit(LAYER_COUNT - 1, NAN));
		Assert.equal(depthLimit(1, 120), 120);
		Assert.equal(depthLimit(LAYER_COUNT, undefined), MAX_DEPTH_METERS);
		Assert.undefined(depthLimit(NAN, 120));
	}

	@Test
	public layerDecidesBeforeMeters() {
		Assert.true(depthScore(2, 0) > depthScore(1, MAX_DEPTH_METERS));
		Assert.true(depthScore(2, 11) > depthScore(2, 10));
	}

	@Test
	public depthScoreRoundTrips() {
		const record = decodeDepthScore(depthScore(3, 1234));
		Assert.equal(record.layer, 3);
		Assert.equal(record.meters, 1234);
	}

	@Test
	public depthScoreRepairsBadInput() {
		Assert.equal(depthScore(NAN, NAN), depthScore(1, 0));
		Assert.equal(depthScore(999, 5), depthScore(LAYER_COUNT, 5));
		Assert.equal(depthScore(0, -10), depthScore(1, 0));
		Assert.equal(depthScore(1, math.huge), depthScore(1, 0));
		const broken = decodeDepthScore(NAN);
		Assert.equal(broken.layer, 0);
		Assert.equal(broken.meters, 0);
	}

	@Test
	public wealthIsLifetimeEarnings() {
		Assert.equal(wealthScore(1500.7), 1500);
		Assert.equal(wealthScore(-1), 0);
		Assert.equal(wealthScore(NAN), 0);
		Assert.equal(wealthScore(math.huge), 0);
		Assert.equal(wealthScore(MAX_COUNTER * 10), MAX_COUNTER);
	}

	@Test
	public writesOnlyWhenTheScoreGrew() {
		Assert.true(shouldWrite(undefined, 10));
		Assert.true(shouldWrite(10, 11));
		Assert.false(shouldWrite(10, 10));
		Assert.false(shouldWrite(10, 9));
		Assert.false(shouldWrite(undefined, 0));
		Assert.false(shouldWrite(undefined, NAN));
		Assert.false(shouldWrite(undefined, math.huge));
	}

	@Test
	public storeKeepsTheHigherScore() {
		Assert.equal(higherScore(undefined, 10), 10);
		Assert.equal(higherScore(50, 10), 50);
		Assert.equal(higherScore(5, 10), 10);
		Assert.equal(higherScore("junk", 10), 10);
		Assert.equal(higherScore(NAN, 10), 10);
		Assert.equal(higherScore(math.huge, 10), 10);
	}

	@Test
	public rowsAreSortedAndCut() {
		const raw: Array<{ key: string; value: number }> = [];
		for (let i = 1; i <= LEADERBOARD_SIZE + 5; i++) {
			raw.push({ key: tostring(i), value: i * 10 });
		}
		const rows = cleanRows(raw);
		Assert.equal(rows.size(), LEADERBOARD_SIZE);
		Assert.equal(rows[0].userId, LEADERBOARD_SIZE + 5);
		for (let i = 1; i < rows.size(); i++) {
			Assert.true(rows[i - 1].score >= rows[i].score);
		}
	}

	@Test
	public equalScoresHaveAStableOrder() {
		const rows = cleanRows([
			{ key: "20", value: 5 },
			{ key: "10", value: 5 },
		]);
		Assert.equal(rows[0].userId, 10);
		Assert.equal(rows[1].userId, 20);
	}

	@Test
	public brokenRowsAreDropped() {
		const rows = cleanRows([
			{ key: "1", value: 100 },
			{ key: "1", value: 900 }, // duplicate user
			{ key: "abc", value: 50 },
			{ key: "-3", value: 50 },
			{ key: "2.5", value: 50 },
			{ key: 7, value: 50 },
			{ key: "8", value: NAN },
			{ key: "9", value: math.huge },
			{ key: "10", value: 0 },
			{ key: "11", value: "100" },
			"junk",
			{ key: "12", value: 30.9 },
		]);
		Assert.equal(rows.size(), 2);
		Assert.equal(rows[0].userId, 1);
		Assert.equal(rows[0].score, 100);
		Assert.equal(rows[1].score, 30);
		Assert.equal(cleanRows(undefined).size(), 0);
		Assert.equal(cleanRows("junk").size(), 0);
	}
}

export = LeaderboardTests;
