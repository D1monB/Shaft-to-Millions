import { Assert, Test } from "@rbxts/lunit";
import {
	BELT_SECONDS_PER_ITEM,
	HOPPER_CAPACITY,
	LINE_MACHINES,
	LINE_MAX_STEP,
	LINE_UPGRADES,
	LINE_UPGRADE_TRACKS,
	OFFLINE_MAX_SECONDS,
	STAGE_VALUE,
} from "shared/config/line";
import {
	LineState,
	advanceLine,
	advanceOffline,
	applyBuyLineMachine,
	applyLineUpgrade,
	depositOre,
	intakeRoom,
	isLineIdle,
	itemValue,
	lineIncome,
	machineAction,
	newLineState,
	nextLineMachine,
	nextLineUpgrade,
	queueLimit,
	tryBuyLineMachine,
	tryLineUpgrade,
	upgradeValue,
} from "./line";

const ORE_VALUES: { [ore: string]: number | undefined } = { copper: 10, iron: 25 };
const valueOf = (ore: string) => ORE_VALUES[ore];
const never = () => 0.99; // never duplicates
const always = () => 0; // always duplicates once a chance exists

function lineWith(count: number): LineState {
	const state = newLineState();
	for (let i = 0; i < count; i++) {
		applyBuyLineMachine(state);
	}
	return state;
}

function near(a: number, b: number, message?: string) {
	Assert.true(math.abs(a - b) < 1e-6, message ?? `${a} != ${b}`);
}

class LineTests {
	// ---- config sanity ----

	@Test
	public stageTableMatchesTheLine() {
		Assert.equal(LINE_MACHINES.size() + 1, STAGE_VALUE.size());
		Assert.equal(1, STAGE_VALUE[0]);
		for (let i = 1; i < STAGE_VALUE.size(); i++) {
			Assert.true(STAGE_VALUE[i] > STAGE_VALUE[i - 1], `stage ${i} must be worth more`);
		}
		// Friend's target: a $10 ore ends as a reactor worth more than $10 000.
		Assert.true(10 * STAGE_VALUE[STAGE_VALUE.size() - 1] >= 10_000);
	}

	@Test
	public machinesGetPricierAndHaveTime() {
		for (let i = 0; i < LINE_MACHINES.size(); i++) {
			Assert.true(LINE_MACHINES[i].seconds > 0);
			if (i > 0) {
				Assert.true(LINE_MACHINES[i].price > LINE_MACHINES[i - 1].price, `${LINE_MACHINES[i].id} price`);
			}
		}
	}

	@Test
	public upgradeTracksStartFreeAndOnlyImprove() {
		for (const track of LINE_UPGRADE_TRACKS) {
			const levels = LINE_UPGRADES[track];
			Assert.equal(0, levels[0].priceFactor);
			for (let i = 1; i < levels.size(); i++) {
				Assert.true(levels[i].value > levels[i - 1].value, `${track} ${i} value`);
				Assert.true(levels[i].priceFactor > levels[i - 1].priceFactor, `${track} ${i} price`);
			}
		}
		Assert.true(LINE_UPGRADES.duplicate[LINE_UPGRADES.duplicate.size() - 1].value < 1);
	}

	// ---- buying ----

	@Test
	public machinesAreBoughtInOrder() {
		const state = newLineState();
		Assert.equal("M01", nextLineMachine(state)?.id);
		const result = tryBuyLineMachine(state, 1_000);
		Assert.true(result.ok);
		if (result.ok) {
			Assert.equal(1_000 - LINE_MACHINES[0].price, result.money);
		}
		applyBuyLineMachine(state);
		Assert.equal("M02", nextLineMachine(state)?.id);
	}

	@Test
	public buyRefusesWithoutMoneyOrWhenComplete() {
		const state = newLineState();
		Assert.false(tryBuyLineMachine(state, 0).ok);
		Assert.false(tryBuyLineMachine(state, 0 / 0).ok);
		const full = lineWith(LINE_MACHINES.size() + 3); // extra buys are ignored
		Assert.equal(LINE_MACHINES.size(), full.machines.size());
		const result = tryBuyLineMachine(full, math.huge);
		Assert.true(!result.ok && result.reason === "complete");
	}

	// ---- upgrades ----

	@Test
	public upgradeCostsScaleWithTheMachine() {
		const state = lineWith(2);
		const first = nextLineUpgrade(state, 0, "speed");
		const second = nextLineUpgrade(state, 1, "speed");
		Assert.equal(math.floor(LINE_MACHINES[0].price * LINE_UPGRADES.speed[1].priceFactor), first?.price);
		Assert.true((second?.price ?? 0) > (first?.price ?? 0));
		Assert.equal(2, first?.level);
	}

	@Test
	public upgradeGoesUpToTheTopAndStops() {
		const state = lineWith(1);
		const levels = LINE_UPGRADES.quality.size();
		for (let i = 1; i < levels; i++) {
			Assert.true(tryLineUpgrade(state, 0, "quality", math.huge).ok);
			applyLineUpgrade(state, 0, "quality");
		}
		const result = tryLineUpgrade(state, 0, "quality", math.huge);
		Assert.true(!result.ok && result.reason === "maxed");
		applyLineUpgrade(state, 0, "quality");
		Assert.equal(levels, state.machines[0].quality);
	}

	@Test
	public upgradeRejectsBadInput() {
		const state = lineWith(1);
		for (const index of [-1, 1, 0.5, 0 / 0, math.huge, "0", undefined]) {
			const result = tryLineUpgrade(state, index, "speed", math.huge);
			Assert.true(!result.ok, `index ${tostring(index)}`);
		}
		for (const track of ["fast", "", 3, undefined]) {
			Assert.false(tryLineUpgrade(state, 0, track, math.huge).ok);
		}
		const poor = tryLineUpgrade(state, 0, "speed", 0);
		Assert.true(!poor.ok && poor.reason === "not-enough-money");
		Assert.false(tryLineUpgrade(state, 0, "speed", 0 / 0).ok);
	}

	@Test
	public upgradeValueClampsLevels() {
		Assert.equal(1, upgradeValue("speed", 0));
		Assert.equal(1, upgradeValue("speed", 0 / 0));
		const top = LINE_UPGRADES.speed[LINE_UPGRADES.speed.size() - 1].value;
		Assert.equal(top, upgradeValue("speed", 99));
		// A non-finite level is a broken save, not a maxed machine.
		Assert.equal(1, upgradeValue("speed", math.huge));
	}

	// ---- hopper ----

	@Test
	public depositWorksWithoutMachinesAndRespectsTheIntake() {
		// The belt always exists: ore can be dropped before any machine is bought.
		const state = newLineState();
		const taken = depositOre(state, { copper: HOPPER_CAPACITY - 2, iron: 10 }, ["copper", "iron"]);
		Assert.equal(HOPPER_CAPACITY - 2, taken.get("copper"));
		Assert.equal(2, taken.get("iron"));
		Assert.equal(HOPPER_CAPACITY, state.intake.size());
		Assert.equal(0, intakeRoom(state));
		Assert.equal(0, depositOre(state, { copper: 1 }, ["copper"]).size());
	}

	@Test
	public withoutMachinesRawOreRidesTheBeltToTheSellStation() {
		const state = newLineState();
		depositOre(state, { copper: 5 }, ["copper"]);
		const result = advanceLine(state, BELT_SECONDS_PER_ITEM * 3, valueOf, never);
		Assert.equal(3, result.sold);
		Assert.equal(3 * 10 * STAGE_VALUE[0], result.money);
		Assert.equal(2, state.intake.size());
		// The first machine takes over: from now on the intake feeds it instead of selling raw.
		applyBuyLineMachine(state);
		advanceLine(state, 0, valueOf, never);
		Assert.equal(0, state.intake.size());
		Assert.equal(2, state.machines[0].queue.size());
	}

	@Test
	public intakeFeedsTheFirstMachineOnlyAsFarAsItHasRoom() {
		const state = lineWith(1);
		depositOre(state, { copper: 40 }, ["copper"]);
		advanceLine(state, 0, valueOf, never);
		Assert.equal(queueLimit(state, 0), state.machines[0].queue.size());
		Assert.equal(40 - queueLimit(state, 0), state.intake.size());
	}

	@Test
	public depositIgnoresBrokenCounts() {
		const state = lineWith(1);
		const taken = depositOre(state, { copper: -5, iron: 0 / 0 }, ["copper", "iron", "gold"]);
		Assert.equal(0, taken.size());
		Assert.equal(0, state.machines[0].queue.size());
		const fraction = depositOre(state, { copper: 2.7 }, ["copper"]);
		Assert.equal(2, fraction.get("copper"));
	}

	// ---- value ----

	@Test
	public valueGrowsWithStageAndQuality() {
		const state = lineWith(3);
		near(10 * STAGE_VALUE[1], itemValue(state, "copper", 0, valueOf) as number);
		near(10 * STAGE_VALUE[3], itemValue(state, "copper", 2, valueOf) as number);
		applyLineUpgrade(state, 0, "quality");
		near(10 * STAGE_VALUE[3] * LINE_UPGRADES.quality[1].value, itemValue(state, "copper", 2, valueOf) as number);
		Assert.equal(undefined, itemValue(state, "mystery", 0, valueOf));
	}

	// ---- processing ----

	@Test
	public oneMachineSellsWhatItMakes() {
		const state = lineWith(1);
		depositOre(state, { copper: 3 }, ["copper"]);
		const result = advanceLine(state, LINE_MACHINES[0].seconds * 2, valueOf, never);
		Assert.equal(2, result.sold);
		Assert.equal(math.round(10 * STAGE_VALUE[1]) * 2, result.money);
		Assert.equal(1, state.machines[0].queue.size());
	}

	@Test
	public itemsMoveOneMachinePerStep() {
		const state = lineWith(2);
		depositOre(state, { iron: 1 }, ["iron"]);
		const first = advanceLine(state, LINE_MAX_STEP, valueOf, never);
		Assert.equal(0, first.sold);
		Assert.equal(1, state.machines[1].queue.size());
		const second = advanceLine(state, LINE_MAX_STEP, valueOf, never);
		Assert.equal(1, second.sold);
		Assert.equal(math.round(25 * STAGE_VALUE[2]), second.money);
		Assert.true(isLineIdle(state));
	}

	@Test
	public fullNextQueueStallsWithoutLosingOre() {
		const state = lineWith(3);
		const limit = queueLimit(state, 2);
		for (let i = 0; i < limit; i++) {
			state.machines[2].queue.push("copper");
		}
		// Machine 2 has finished an item but the queue of machine 3 is full.
		state.machines[1].queue.push("iron");
		state.machines[1].progress = LINE_MACHINES[1].seconds;
		const result = advanceLine(state, 0, valueOf, never);
		Assert.equal(0, result.sold);
		Assert.equal(1, state.machines[1].queue.size(), "the stalled machine keeps its ore");
		Assert.equal(limit, state.machines[2].queue.size(), "the full queue never grows past its limit");
		// Once the last machine sells something, the stalled item moves on.
		advanceLine(state, LINE_MACHINES[2].seconds, valueOf, never);
		advanceLine(state, 0, valueOf, never);
		Assert.equal(0, state.machines[1].queue.size());
	}

	@Test
	public duplicateMakesTwo() {
		const state = lineWith(1);
		applyLineUpgrade(state, 0, "duplicate");
		depositOre(state, { copper: 1 }, ["copper"]);
		const result = advanceLine(state, LINE_MACHINES[0].seconds, valueOf, always);
		Assert.equal(2, result.sold);
	}

	@Test
	public noDuplicateWithoutTheUpgrade() {
		const state = lineWith(1);
		depositOre(state, { copper: 1 }, ["copper"]);
		Assert.equal(1, advanceLine(state, LINE_MACHINES[0].seconds, valueOf, always).sold);
	}

	@Test
	public speedUpgradeProcessesMore() {
		const slow = lineWith(1);
		const fast = lineWith(1);
		for (let i = 1; i < LINE_UPGRADES.speed.size(); i++) {
			applyLineUpgrade(fast, 0, "speed");
		}
		depositOre(slow, { copper: 50 }, ["copper"]);
		depositOre(fast, { copper: 50 }, ["copper"]);
		const a = advanceLine(slow, LINE_MAX_STEP, valueOf, never).sold;
		const b = advanceLine(fast, LINE_MAX_STEP, valueOf, never).sold;
		Assert.true(b > a, `${b} should beat ${a}`);
	}

	@Test
	public badTimeDoesNothing() {
		const state = lineWith(1);
		depositOre(state, { copper: 10 }, ["copper"]);
		for (const dt of [-5, 0 / 0, -math.huge, math.huge]) {
			Assert.equal(0, advanceLine(state, dt, valueOf, never).sold);
		}
		Assert.equal(10, state.machines[0].queue.size());
		// A long step is clamped to LINE_MAX_STEP, not a jackpot.
		const capped = advanceLine(state, 1e9, valueOf, never).sold;
		Assert.equal(math.floor(LINE_MAX_STEP / LINE_MACHINES[0].seconds), capped);
	}

	@Test
	public unknownOreIsDroppedNotSold() {
		const state = lineWith(1);
		state.machines[0].queue.push("mystery", "copper");
		const result = advanceLine(state, LINE_MACHINES[0].seconds * 2, valueOf, never);
		Assert.equal(1, result.sold);
		Assert.true(isLineIdle(state));
	}

	@Test
	public idleTimeIsNotBanked() {
		const state = lineWith(1);
		advanceLine(state, LINE_MAX_STEP, valueOf, never);
		depositOre(state, { copper: 1 }, ["copper"]);
		Assert.equal(0, advanceLine(state, 0.01, valueOf, never).sold);
	}

	// ---- offline ----

	@Test
	public offlineFinishesTheQueueAtReducedSpeed() {
		const state = lineWith(1);
		depositOre(state, { copper: 4 }, ["copper"]);
		// At half speed, 4 items of 1.5 s need 12 real seconds.
		const short = advanceOffline(state, 6, valueOf, never);
		Assert.equal(2, short.sold);
		const rest = advanceOffline(state, 3_600, valueOf, never);
		Assert.equal(2, rest.sold);
		Assert.true(isLineIdle(state));
	}

	@Test
	public offlineRejectsBadTimeAndIsCapped() {
		const state = lineWith(1);
		depositOre(state, { copper: HOPPER_CAPACITY }, ["copper"]);
		for (const elapsed of [-100, 0 / 0, -math.huge]) {
			Assert.equal(0, advanceOffline(state, elapsed, valueOf, never).sold);
		}
		const capped = advanceOffline(lineWith(0), math.huge, valueOf, never);
		Assert.equal(0, capped.sold);
		// The cap bounds the work: OFFLINE_MAX_SECONDS at half speed is far more than 500 items need, so all are sold.
		const all = advanceOffline(state, OFFLINE_MAX_SECONDS * 10, valueOf, never);
		Assert.equal(HOPPER_CAPACITY, all.sold);
	}

	// ---- machine prompts ----

	@Test
	public promptActionsFollowTheBuyOrder() {
		const state = newLineState();
		const first = machineAction(state, 0);
		Assert.true(first.kind === "buy" && first.price === LINE_MACHINES[0].price);
		Assert.equal("locked", machineAction(state, 1).kind);
		applyBuyLineMachine(state);
		Assert.equal("upgrade", machineAction(state, 0).kind);
		Assert.equal("buy", machineAction(state, 1).kind);
		applyBuyLineMachine(state);
		Assert.equal("upgrade", machineAction(state, 1).kind);
		Assert.equal("locked", machineAction(state, 3).kind);
	}

	@Test
	public promptActionRejectsBadIndexes() {
		const state = lineWith(2);
		for (const index of [-1, 0.5, 0 / 0, math.huge, LINE_MACHINES.size()]) {
			Assert.equal("locked", machineAction(state, index).kind, `index ${index}`);
		}
	}

	// ---- income ----

	@Test
	public incomeAppliesTheSellBonusAndRoundsDown() {
		Assert.equal(15, lineIncome(10, 1.5));
		Assert.equal(12, lineIncome(10, 1.25));
		Assert.equal(10, lineIncome(10, 0 / 0));
		Assert.equal(10, lineIncome(10, -2));
		Assert.equal(10, lineIncome(10, math.huge));
		Assert.equal(0, lineIncome(-5, 2));
		Assert.equal(0, lineIncome(0 / 0, 2));
	}
}

export = LineTests;
