import { Assert, Test } from "@rbxts/lunit";
import { BOOSTERS, BOOSTER_IDS, BOOST_MAX_SECONDS } from "shared/config/boosters";
import { activeBoosters, addBoost, boostMultiplier, boostSecondsLeft, newBoostState } from "./boosters";

const NOW = 1_000_000;

class BoostersTests {
	@Test
	public offBoosterHasNoTimeAndNoBonus() {
		const state = newBoostState();
		Assert.equal(boostSecondsLeft(state, "money", NOW), 0);
		Assert.equal(boostMultiplier(state, "money", NOW), 1);
	}

	@Test
	public activeBoosterCountsDownAndUsesItsMultiplier() {
		const state = newBoostState();
		state.ore = NOW + 100;
		Assert.equal(boostSecondsLeft(state, "ore", NOW), 100);
		Assert.equal(boostMultiplier(state, "ore", NOW), BOOSTERS.ore.multiplier);
		// Boundary: the exact end moment and one second past it are both off.
		Assert.equal(boostSecondsLeft(state, "ore", NOW + 100), 0);
		Assert.equal(boostMultiplier(state, "ore", NOW + 100), 1);
		Assert.equal(boostSecondsLeft(state, "ore", NOW + 101), 0);
	}

	@Test
	public brokenEndTimeCountsAsOff() {
		for (const broken of [0 / 0, math.huge, -math.huge]) {
			const state = newBoostState();
			state.money = broken;
			Assert.equal(boostSecondsLeft(state, "money", NOW), 0);
			Assert.equal(boostMultiplier(state, "money", NOW), 1);
		}
	}

	@Test
	public brokenNowCountsAsOff() {
		const state = newBoostState();
		state.money = NOW + 100;
		Assert.equal(boostSecondsLeft(state, "money", 0 / 0), 0);
		Assert.equal(boostSecondsLeft(state, "money", math.huge), 0);
		Assert.equal(boostSecondsLeft(state, "money", -math.huge), 0);
	}

	@Test
	public absurdlyFarEndIsClampedToTheMaximum() {
		const state = newBoostState();
		state.line = NOW + BOOST_MAX_SECONDS * 1000;
		Assert.equal(boostSecondsLeft(state, "line", NOW), BOOST_MAX_SECONDS);
		state.line = 1e300;
		Assert.equal(boostSecondsLeft(state, "line", NOW), BOOST_MAX_SECONDS);
	}

	@Test
	public addingToAnOffBoosterStartsFromNow() {
		const state = newBoostState();
		Assert.equal(addBoost(state, "money", 600, NOW), 600);
		Assert.equal(state.money, NOW + 600);
		Assert.equal(boostMultiplier(state, "money", NOW), BOOSTERS.money.multiplier);
	}

	@Test
	public addingToAnExpiredBoosterStartsFromNowNotFromTheOldEnd() {
		const state = newBoostState();
		state.money = NOW - 5000;
		Assert.equal(addBoost(state, "money", 600, NOW), 600);
		Assert.equal(state.money, NOW + 600);
	}

	@Test
	public addingToAnActiveBoosterExtendsIt() {
		const state = newBoostState();
		state.ore = NOW + 100;
		Assert.equal(addBoost(state, "ore", 50, NOW), 50);
		Assert.equal(state.ore, NOW + 150);
		// Other boosters are untouched.
		Assert.equal(state.money, 0);
		Assert.equal(state.line, 0);
	}

	@Test
	public additionIsCappedAndReportsWhatWasReallyAdded() {
		const state = newBoostState();
		state.ore = NOW + BOOST_MAX_SECONDS - 10;
		Assert.equal(addBoost(state, "ore", 1000, NOW), 10);
		Assert.equal(state.ore, NOW + BOOST_MAX_SECONDS);
		// From off, a huge purchase is cut to the maximum.
		const fresh = newBoostState();
		Assert.equal(addBoost(fresh, "ore", BOOST_MAX_SECONDS * 5, NOW), BOOST_MAX_SECONDS);
		Assert.equal(fresh.ore, NOW + BOOST_MAX_SECONDS);
	}

	@Test
	public aFullBoosterAddsNothing() {
		const state = newBoostState();
		state.line = NOW + BOOST_MAX_SECONDS;
		Assert.equal(addBoost(state, "line", 600, NOW), 0);
		Assert.equal(state.line, NOW + BOOST_MAX_SECONDS);
	}

	@Test
	public aBoosterWithAnAbsurdEndIsTreatedAsFullAndNotChanged() {
		const state = newBoostState();
		state.line = 1e300;
		Assert.equal(addBoost(state, "line", 600, NOW), 0);
		Assert.equal(state.line, 1e300);
	}

	@Test
	public badSecondsAddNothingAndKeepTheState() {
		for (const bad of [0, -1, -math.huge, 0 / 0, math.huge]) {
			const state = newBoostState();
			state.money = NOW + 100;
			Assert.equal(addBoost(state, "money", bad, NOW), 0);
			Assert.equal(state.money, NOW + 100);
			Assert.equal(state.ore, 0);
		}
	}

	@Test
	public badNowAddsNothingAndKeepsTheState() {
		for (const bad of [0, -1, 0 / 0, math.huge, -math.huge]) {
			const state = newBoostState();
			Assert.equal(addBoost(state, "money", 600, bad), 0);
			Assert.equal(state.money, 0);
		}
	}

	@Test
	public spamNeverPassesTheCap() {
		const state = newBoostState();
		let total = 0;
		for (let i = 0; i < 1000; i++) {
			total += addBoost(state, "money", 3600, NOW);
		}
		Assert.equal(total, BOOST_MAX_SECONDS);
		Assert.equal(boostSecondsLeft(state, "money", NOW), BOOST_MAX_SECONDS);
	}

	@Test
	public activeBoostersListsOnlyRunningOnesInDisplayOrder() {
		const state = newBoostState();
		Assert.equal(activeBoosters(state, NOW).size(), 0);
		state.line = NOW + 10;
		state.money = NOW + 10;
		state.ore = NOW - 10;
		const active = activeBoosters(state, NOW);
		Assert.equal(active.size(), 2);
		Assert.equal(active[0], "money");
		Assert.equal(active[1], "line");
		for (const id of BOOSTER_IDS) {
			state[id] = NOW + 10;
		}
		const all = activeBoosters(state, NOW);
		Assert.equal(all.size(), BOOSTER_IDS.size());
		for (let i = 0; i < all.size(); i++) {
			Assert.equal(all[i], BOOSTER_IDS[i]);
		}
	}
}

export = BoostersTests;
