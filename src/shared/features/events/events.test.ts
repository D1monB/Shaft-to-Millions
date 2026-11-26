import { Assert, Test } from "@rbxts/lunit";
import {
	CAVE_IN_RADIUS,
	CLUSTER_MIN_HITS,
	RAID_COOLDOWN_SECONDS,
	RAID_MAX_CRYSTALS,
	RAID_PIECES_PER_CRYSTAL,
	RAID_SECONDS,
} from "shared/config/events";
import {
	addRaidOre,
	caveInHits,
	clusterCrystals,
	clusterHit,
	finishRaid,
	newCluster,
	newRaidState,
	raidCooldownLeft,
	startRaid,
	weekOf,
} from "./events";

const NOW = 2_000_000_000;

class EventsTests {
	@Test
	public caveInOnlyHitsInsideTheCircle() {
		Assert.true(caveInHits(0));
		Assert.true(caveInHits(CAVE_IN_RADIUS));
		Assert.false(caveInHits(CAVE_IN_RADIUS + 0.1));
		for (const bad of [0 / 0, -1, math.huge]) {
			Assert.false(caveInHits(bad), `distance ${bad}`);
		}
	}

	@Test
	public clusterIsSharedAndSpamProof() {
		const cluster = newCluster(6);
		Assert.equal(clusterHit(cluster, 1, 10, 0.5), "hit");
		for (let i = 0; i < 100; i++) {
			Assert.equal(clusterHit(cluster, 1, 10 + i / 1000, 0.5), "cooldown");
		}
		for (let i = 0; i < 4; i++) {
			Assert.equal(clusterHit(cluster, 1, 11 + i, 0.5), "hit");
		}
		Assert.equal(clusterHit(cluster, 2, 11, 0.5), "broken");
		Assert.equal(clusterHit(cluster, 2, 99, 0.5), "gone");
		Assert.true(clusterCrystals(cluster, 1) > 0);
		Assert.equal(clusterCrystals(cluster, 2), 0);
		Assert.equal(clusterCrystals(cluster, 3), 0);
		Assert.true(CLUSTER_MIN_HITS > 1);
	}

	@Test
	public clusterBadInput() {
		const cluster = newCluster(0 / 0);
		Assert.equal(cluster.needed, 1);
		Assert.equal(clusterHit(cluster, 1, 0 / 0, 0.5), "cooldown");
		Assert.equal(clusterHit(cluster, 1, 5, 0), "cooldown");
		Assert.equal(clusterHit(cluster, 1, 5, 0.5), "broken");
	}

	@Test
	public raidHasCooldownAndOnlyCountsWhileRunning() {
		const state = newRaidState();
		const run = startRaid(state, NOW);
		Assert.notEqual(run, undefined);
		if (run === undefined) {
			return;
		}
		Assert.equal(startRaid(state, NOW + 1), undefined);
		Assert.true(raidCooldownLeft(state, NOW + 1) > 0);
		Assert.equal(raidCooldownLeft(state, NOW - 100), RAID_COOLDOWN_SECONDS);
		addRaidOre(run, 10, 5, NOW + 1);
		addRaidOre(run, 10, 5, NOW + RAID_SECONDS);
		addRaidOre(run, 0 / 0, 5, NOW + 2);
		addRaidOre(run, 10, -5, NOW + 2);
		Assert.equal(run.score, 50);
		Assert.equal(run.pieces, 5);
		Assert.notEqual(startRaid(state, NOW + RAID_COOLDOWN_SECONDS), undefined);
	}

	@Test
	public raidRewardIsCappedAndBestIsPerWeek() {
		const state = newRaidState();
		const first = finishRaid(state, { endsAt: NOW, score: 100, pieces: 1e6 }, NOW);
		Assert.equal(first.crystals, RAID_MAX_CRYSTALS);
		Assert.true(first.newBest);
		const lower = finishRaid(state, { endsAt: NOW, score: 50, pieces: RAID_PIECES_PER_CRYSTAL - 1 }, NOW);
		Assert.false(lower.newBest);
		Assert.equal(lower.crystals, 0);
		const nextWeek = finishRaid(state, { endsAt: NOW, score: 1, pieces: 0 }, NOW + 8 * 86_400);
		Assert.true(nextWeek.newBest);
		Assert.equal(state.best, 1);
		Assert.equal(weekOf(0 / 0), 0);
		Assert.equal(weekOf(-5), 0);
	}
}

export = EventsTests;
