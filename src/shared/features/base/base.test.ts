import { Assert, Test } from "@rbxts/lunit";
import { BUILDINGS, BUILDING_IDS, SKIP_SECONDS_PER_CRYSTAL } from "shared/config/base";
import { OFFLINE_MAX_SECONDS } from "shared/config/line";
import { advanceOffline, newLineState } from "shared/features/line";
import {
	MAX_BUILDERS,
	applySkip,
	applyStart,
	baseEffects,
	completeJobs,
	levelOf,
	newBaseState,
	secondsLeft,
	skipCost,
	tryHireBuilder,
	trySkip,
	tryStartBuild,
} from "./base";

const NOW = 1_000_000;
const OFFICE_1 = BUILDINGS.office.levels[0];

class BaseTests {
	@Test
	public configIsSane() {
		for (const id of BUILDING_IDS) {
			const levels = BUILDINGS[id].levels;
			Assert.equal(levels.size(), 6);
			for (let i = 1; i < levels.size(); i++) {
				Assert.true(levels[i].price > levels[i - 1].price, `${id} price ${i}`);
				Assert.true(levels[i].seconds > levels[i - 1].seconds, `${id} time ${i}`);
			}
		}
	}

	@Test
	public buildingTakesTimeAndThenRaisesTheLevel() {
		const state = newBaseState();
		const result = tryStartBuild(state, "office", OFFICE_1.price, NOW);
		Assert.true(result.ok);
		if (!result.ok) {
			return;
		}
		Assert.equal(result.money, 0);
		applyStart(state, "office", result.finishAt);
		Assert.equal(secondsLeft(state, "office", NOW), OFFICE_1.seconds);
		Assert.equal(completeJobs(state, NOW + OFFICE_1.seconds - 1).size(), 0);
		Assert.equal(levelOf(state, "office"), 0);
		Assert.equal(completeJobs(state, NOW + OFFICE_1.seconds)[0], "office");
		Assert.equal(levelOf(state, "office"), 1);
		Assert.equal(state.jobs.size(), 0);
	}

	@Test
	public otherBuildingsNeedTheOffice() {
		const state = newBaseState();
		const refused = tryStartBuild(state, "market", 1e12, NOW);
		Assert.true(!refused.ok && refused.reason === "office");
		state.levels.office = 1;
		Assert.true(tryStartBuild(state, "market", 1e12, NOW).ok);
		state.levels.market = 1;
		Assert.false(tryStartBuild(state, "market", 1e12, NOW).ok);
	}

	@Test
	public buildersLimitParallelBuilds() {
		const state = newBaseState();
		state.levels.office = 1;
		applyStart(state, "market", NOW + 100);
		const refused = tryStartBuild(state, "hut", 1e12, NOW);
		Assert.true(!refused.ok && refused.reason === "no-builder");
		const busy = tryStartBuild(state, "market", 1e12, NOW);
		Assert.true(!busy.ok && busy.reason === "busy");
		state.builders = 2;
		Assert.true(tryStartBuild(state, "hut", 1e12, NOW).ok);
	}

	@Test
	public badInputNeverBuilds() {
		const state = newBaseState();
		for (const id of [undefined, "", "castle", 5, {}] as unknown[]) {
			Assert.false(tryStartBuild(state, id, 1e12, NOW).ok);
		}
		for (const money of [0 / 0, -1, 0, -math.huge]) {
			Assert.false(tryStartBuild(state, "office", money, NOW).ok, `money ${money}`);
		}
		for (const time of [0 / 0, 0, -5, math.huge]) {
			Assert.false(tryStartBuild(state, "office", 1e12, time).ok, `time ${time}`);
		}
		Assert.equal(completeJobs(state, 0 / 0).size(), 0);
	}

	@Test
	public maxedBuildingCannotBeBuilt() {
		const state = newBaseState();
		state.levels.office = 6;
		const result = tryStartBuild(state, "office", 1e12, NOW);
		Assert.true(!result.ok && result.reason === "maxed");
	}

	@Test
	public skipCostsCrystalsPerTimeLeft() {
		Assert.equal(skipCost(0), 0);
		Assert.equal(skipCost(-3), 0);
		Assert.equal(skipCost(0 / 0), 0);
		Assert.equal(skipCost(1), 1);
		Assert.equal(skipCost(SKIP_SECONDS_PER_CRYSTAL * 3 + 1), 4);
	}

	@Test
	public skipFinishesTheBuildOnce() {
		const state = newBaseState();
		applyStart(state, "office", NOW + 600);
		const poor = trySkip(state, "office", 1, NOW);
		Assert.true(!poor.ok && poor.reason === "not-enough-crystals");
		const ok = trySkip(state, "office", 10, NOW);
		Assert.true(ok.ok);
		applySkip(state, "office", NOW);
		completeJobs(state, NOW);
		Assert.equal(levelOf(state, "office"), 1);
		const again = trySkip(state, "office", 10, NOW);
		Assert.true(!again.ok && again.reason === "not-building");
		Assert.false(trySkip(state, "castle", 10, NOW).ok);
	}

	@Test
	public buildersAreHiredUpToTheMaximum() {
		const state = newBaseState();
		Assert.false(tryHireBuilder(state, 0).ok);
		Assert.false(tryHireBuilder(state, 0 / 0).ok);
		while (state.builders < MAX_BUILDERS) {
			Assert.true(tryHireBuilder(state, 1e9).ok);
			state.builders += 1;
		}
		const full = tryHireBuilder(state, 1e9);
		Assert.true(!full.ok && full.reason === "maxed");
	}

	@Test
	public effectsGrowWithLevels() {
		const state = newBaseState();
		const none = baseEffects(state);
		Assert.equal(none.sellBonus, 0);
		Assert.equal(none.lineSpeed, 1);
		Assert.equal(none.offlineSeconds, OFFLINE_MAX_SECONDS);
		state.levels.market = 6;
		state.levels.warehouse = 3;
		Assert.true(baseEffects(state).sellBonus > 0.29);
		Assert.true(baseEffects(state).offlineSeconds > OFFLINE_MAX_SECONDS);
		state.levels.market = 999;
		Assert.true(baseEffects(state).sellBonus < 0.31);
	}

	@Test
	public offlineBonusIsClamped() {
		const line = newLineState();
		for (let i = 0; i < 10; i++) {
			line.intake.push("copper");
		}
		const result = advanceOffline(
			line,
			100_000,
			() => 10,
			() => 0.9,
			0 / 0,
			math.huge,
		);
		Assert.equal(result.sold, 10);
	}
}

export = BaseTests;
