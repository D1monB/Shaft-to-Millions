import { Assert, Test } from "@rbxts/lunit";
import { MACHINE_UPGRADES, RECIPES, RECIPE_IDS, WAREHOUSE_LEVELS, recipesOf } from "shared/config/machines";
import { RESOURCES } from "shared/config/resources";
import {
	Counts,
	advance,
	cancelLast,
	collect,
	craftSeconds,
	depositAll,
	enqueue,
	machineProgress,
	maxCrafts,
	newMachineState,
	nextMachineUpgrade,
	nextWarehouseUpgrade,
	queueLimitOf,
	setSpeedLevel,
	simulateProcessing,
	storageTotal,
	warehouseCapacity,
} from "./factory";

const LIMIT = queueLimitOf("furnace", 1);

function valueOf(amounts: { [id: string]: number | undefined }): number {
	let value = 0;
	for (const [id, amount] of pairs(amounts)) {
		value += RESOURCES[id as keyof typeof RESOURCES].price * (amount as number);
	}
	return value;
}

class FactoryTests {
	// ---- config sanity ----

	@Test
	public everyRecipeAddsValue() {
		// Processing must always be worth more than selling the inputs, or the factory makes no sense.
		for (const id of RECIPE_IDS) {
			const recipe = RECIPES[id];
			Assert.true(valueOf(recipe.outputs) > valueOf(recipe.inputs), `${id} loses value`);
			Assert.true(recipe.seconds > 0);
		}
	}

	@Test
	public everyMachineHasRecipes() {
		Assert.true(recipesOf("furnace").size() > 0);
		Assert.true(recipesOf("workbench").size() > 0);
	}

	// ---- queue ----

	@Test
	public enqueueReservesInputsImmediately() {
		const state = newMachineState();
		const store: Counts = { copper: 10 };
		const result = enqueue(state, store, "smelt_copper", 2, 100, LIMIT);
		Assert.true(result.ok);
		Assert.equal(store.copper, 4);
		Assert.equal(state.queue.size(), 2);
		Assert.equal(state.startedAt, 100);
	}

	@Test
	public enqueueTakesOnlyWhatIsAffordable() {
		const state = newMachineState();
		const store: Counts = { copper: 7 };
		const result = enqueue(state, store, "smelt_copper", 5, 0, LIMIT);
		Assert.true(result.ok && result.added === 2);
		Assert.equal(store.copper, 1);
	}

	@Test
	public enqueueRefusesWithoutInputs() {
		const state = newMachineState();
		const store: Counts = { iron: 10 }; // smelting iron also needs coal
		const result = enqueue(state, store, "smelt_iron", 1, 0, LIMIT);
		Assert.false(result.ok);
		Assert.equal(store.iron, 10);
	}

	@Test
	public enqueueRespectsQueueLimit() {
		const state = newMachineState();
		const store: Counts = { copper: 1000 };
		enqueue(state, store, "smelt_copper", 100, 0, LIMIT);
		Assert.equal(state.queue.size(), LIMIT);
		const again = enqueue(state, store, "smelt_copper", 1, 0, LIMIT);
		Assert.false(again.ok);
		Assert.equal(store.copper, 1000 - LIMIT * 3);
	}

	@Test
	public enqueueRejectsHostileCounts() {
		for (const count of [0, -5, 0 / 0, math.huge]) {
			const state = newMachineState();
			const store: Counts = { copper: 30 };
			Assert.false(enqueue(state, store, "smelt_copper", count, 0, LIMIT).ok, `count ${count}`);
			Assert.equal(store.copper, 30);
		}
	}

	@Test
	public advanceFinishesCraftsBackToBack() {
		const state = newMachineState();
		const store: Counts = { copper: 9 };
		enqueue(state, store, "smelt_copper", 3, 0, LIMIT); // 6s each
		Assert.equal(advance(state, 5), 0);
		Assert.equal(advance(state, 6), 1);
		Assert.equal(state.startedAt, 6);
		Assert.equal(advance(state, 18), 2);
		Assert.equal(state.ready.copper_ingot, 3);
		Assert.equal(state.queue.size(), 0);
	}

	@Test
	public offlineTimeFinishesTheWholeQueue() {
		// Player queued 10 crafts and left for a day.
		const state = newMachineState();
		const store: Counts = { copper: 30 };
		enqueue(state, store, "smelt_copper", 10, 1000, LIMIT);
		Assert.equal(advance(state, 1000 + 86400), 10);
		Assert.equal(state.ready.copper_ingot, 10);
	}

	@Test
	public futureStartTimeIsRepaired() {
		const state = newMachineState();
		state.queue = ["smelt_copper"];
		state.startedAt = 1e10; // corrupted save
		advance(state, 100);
		Assert.equal(state.startedAt, 100);
		Assert.equal(advance(state, 106), 1);
	}

	@Test
	public progressReportsCurrentAndTotal() {
		const state = newMachineState();
		const store: Counts = { copper: 6 };
		enqueue(state, store, "smelt_copper", 2, 0, LIMIT);
		const progress = machineProgress(state, 3);
		Assert.equal(progress.current, "smelt_copper");
		Assert.equal(progress.fraction, 0.5);
		Assert.equal(progress.secondsLeft, 3);
		Assert.equal(progress.totalSecondsLeft, 9);
		Assert.undefined(machineProgress(newMachineState(), 0).current);
	}

	@Test
	public cancelRefundsOnlyQueuedCrafts() {
		const state = newMachineState();
		const store: Counts = { copper: 6 };
		enqueue(state, store, "smelt_copper", 2, 0, LIMIT);
		Assert.true(cancelLast(state, store, 100));
		Assert.equal(store.copper, 3);
		// The craft in progress cannot be cancelled: its ore is already in the furnace.
		Assert.false(cancelLast(state, store, 100));
		Assert.equal(state.queue.size(), 1);
	}

	@Test
	public cancelDoesNotOverfillTheWarehouse() {
		const state = newMachineState();
		const store: Counts = { copper: 6 };
		enqueue(state, store, "smelt_copper", 2, 0, LIMIT);
		store.coal = 100;
		Assert.false(cancelLast(state, store, 100));
		Assert.equal(state.queue.size(), 2);
	}

	@Test
	public collectMovesOnlyWhatFits() {
		const state = newMachineState();
		state.ready = { copper_ingot: 5 };
		const store: Counts = { coal: 8 };
		Assert.equal(collect(state, store, 10), 2);
		Assert.equal(store.copper_ingot, 2);
		Assert.equal(state.ready.copper_ingot, 3);
		Assert.equal(storageTotal(store), 10);
	}

	// ---- warehouse ----

	@Test
	public depositStopsAtCapacityAndKeepsTheRest() {
		const bag: { [id: string]: number | undefined } = { coal: 5, copper: 5 };
		const store: Counts = {};
		Assert.equal(depositAll(bag, store, ["coal", "copper"], 7), 7);
		Assert.equal(store.coal, 5);
		Assert.equal(store.copper, 2);
		Assert.undefined(bag.coal);
		Assert.equal(bag.copper, 3);
	}

	@Test
	public depositIgnoresBadCounts() {
		const bag: { [id: string]: number | undefined } = { coal: -5, copper: 0 / 0 };
		const store: Counts = {};
		Assert.equal(depositAll(bag, store, ["coal", "copper"], 100), 0);
		Assert.equal(storageTotal(store), 0);
	}

	@Test
	public maxCraftsUsesTheScarcestInput() {
		Assert.equal(maxCrafts({ iron: 10, coal: 2 }, "smelt_iron"), 2);
		Assert.equal(maxCrafts({}, "smelt_iron"), 0);
	}

	// ---- estimate shown before selling ----

	@Test
	public estimateShowsTheGainOfProcessing() {
		const estimate = simulateProcessing({ copper: 6 }, recipesOf("furnace"));
		Assert.equal(estimate.crafts, 2);
		Assert.equal(estimate.seconds, 12);
		Assert.equal(estimate.valueBefore, 6 * RESOURCES.copper.price);
		Assert.equal(estimate.valueAfter, 2 * RESOURCES.copper_ingot.price);
	}

	@Test
	public estimateOfNothingIsNothing() {
		const estimate = simulateProcessing({ coal: 3 }, recipesOf("furnace"));
		Assert.equal(estimate.crafts, 0);
		Assert.equal(estimate.valueAfter, estimate.valueBefore);
	}

	@Test
	public estimateIsBoundedForHugeInput() {
		const estimate = simulateProcessing({ copper: 1e9 }, recipesOf("furnace"));
		Assert.true(estimate.crafts <= 2000);
	}

	// ------------------------------------------------------------ upgrades

	@Test
	public speedLevelMakesCraftsFaster() {
		const base = craftSeconds("smelt_copper", 1);
		const top = craftSeconds("smelt_copper", MACHINE_UPGRADES.furnace.speed.size());
		Assert.equal(base, RECIPES.smelt_copper.seconds);
		Assert.true(top < base);
		Assert.true(math.abs(top - base / 2) < 0.0001);
	}

	@Test
	public advanceUsesTheMachineSpeedLevel() {
		const state = newMachineState();
		state.speedLevel = MACHINE_UPGRADES.furnace.speed.size();
		enqueue(state, { copper: 3 }, "smelt_copper", 1, 0, 10);
		const fastTime = craftSeconds("smelt_copper", state.speedLevel);
		Assert.equal(advance(state, fastTime - 0.01), 0);
		Assert.equal(advance(state, fastTime + 0.01), 1);
		// The same moment is far too early for a base machine.
		const slow = newMachineState();
		enqueue(slow, { copper: 3 }, "smelt_copper", 1, 0, 10);
		Assert.equal(advance(slow, fastTime + 0.01), 0);
	}

	@Test
	public offlineTimeIsUsedAtTheUpgradedSpeed() {
		const state = newMachineState();
		state.speedLevel = 2;
		enqueue(state, { copper: 30 }, "smelt_copper", 10, 0, 10);
		const each = craftSeconds("smelt_copper", 2);
		Assert.equal(advance(state, each * 10 + 1), 10);
	}

	@Test
	public progressUsesTheMachineSpeedLevel() {
		const state = newMachineState();
		state.speedLevel = MACHINE_UPGRADES.furnace.speed.size();
		enqueue(state, { copper: 6 }, "smelt_copper", 2, 0, 10);
		const each = craftSeconds("smelt_copper", state.speedLevel);
		const progress = machineProgress(state, 0);
		Assert.true(math.abs(progress.secondsLeft - each) < 0.0001);
		Assert.true(math.abs(progress.totalSecondsLeft - each * 2) < 0.0001);
	}

	@Test
	public brokenLevelsNeverIndexOutsideTheTables() {
		for (const bad of [0 / 0, -5, 0, 999, math.huge, -math.huge, 1.7]) {
			const seconds = craftSeconds("smelt_copper", bad);
			Assert.true(seconds === seconds && seconds > 0 && seconds < math.huge);
			Assert.true(queueLimitOf("furnace", bad) >= 10);
			Assert.true(warehouseCapacity(bad) >= 1000);
		}
		const queue = MACHINE_UPGRADES.furnace.queue;
		Assert.equal(queueLimitOf("furnace", 999), queue[queue.size() - 1].value);
	}

	@Test
	public queueLimitGrowsWithTheLevel() {
		for (const machine of ["furnace", "workbench"] as const) {
			let previous = 0;
			for (let level = 1; level <= MACHINE_UPGRADES[machine].queue.size(); level++) {
				const limit = queueLimitOf(machine, level);
				Assert.true(limit > previous);
				previous = limit;
			}
		}
	}

	@Test
	public everyTrackGetsBetterAndMoreExpensive() {
		for (const machine of ["furnace", "workbench"] as const) {
			for (const track of ["speed", "queue"] as const) {
				const levels = MACHINE_UPGRADES[machine][track];
				Assert.equal(levels[0].price, 0);
				for (let i = 1; i < levels.size(); i++) {
					Assert.true(levels[i].value > levels[i - 1].value);
					Assert.true(levels[i].price > levels[i - 1].price);
				}
			}
		}
		for (let i = 1; i < WAREHOUSE_LEVELS.size(); i++) {
			Assert.true(WAREHOUSE_LEVELS[i].value > WAREHOUSE_LEVELS[i - 1].value);
			Assert.true(WAREHOUSE_LEVELS[i].price > WAREHOUSE_LEVELS[i - 1].price);
		}
	}

	@Test
	public nextUpgradeWalksUpAndStopsAtTheTop() {
		const state = newMachineState();
		const speedLevels = MACHINE_UPGRADES.furnace.speed;
		for (let level = 1; level < speedLevels.size(); level++) {
			const step = nextMachineUpgrade("furnace", state, "speed");
			Assert.equal(step?.level, level + 1);
			Assert.equal(step?.price, speedLevels[level].price);
			state.speedLevel = step?.level ?? level;
		}
		Assert.undefined(nextMachineUpgrade("furnace", state, "speed"));
		// The queue track is independent of the speed track.
		Assert.equal(nextMachineUpgrade("furnace", state, "queue")?.level, 2);
	}

	@Test
	public nextUpgradeSurvivesBrokenLevels() {
		const state = newMachineState();
		state.speedLevel = 0 / 0;
		Assert.equal(nextMachineUpgrade("furnace", state, "speed")?.level, 2);
		state.speedLevel = 999;
		Assert.undefined(nextMachineUpgrade("furnace", state, "speed"));
		state.speedLevel = -4;
		Assert.equal(nextMachineUpgrade("furnace", state, "speed")?.level, 2);
	}

	@Test
	public warehouseUpgradeWalksUpAndStopsAtTheTop() {
		let level = 1;
		let steps = 0;
		for (;;) {
			const step = nextWarehouseUpgrade(level);
			if (step === undefined) {
				break;
			}
			Assert.equal(step.level, level + 1);
			Assert.equal(warehouseCapacity(step.level), step.value);
			level = step.level;
			steps += 1;
			Assert.true(steps < 20);
		}
		Assert.equal(level, WAREHOUSE_LEVELS.size());
		Assert.undefined(nextWarehouseUpgrade(999));
	}

	@Test
	public estimateUsesGivenSecondsPerCraft() {
		const counts: Counts = { copper: 6 };
		const base = simulateProcessing(counts, ["smelt_copper"]);
		const fast = simulateProcessing(counts, ["smelt_copper"], () => 1);
		Assert.equal(base.crafts, fast.crafts);
		Assert.equal(fast.seconds, fast.crafts);
		Assert.true(fast.seconds < base.seconds);
	}

	@Test
	public speedUpgradeKeepsTheShareOfTheCraftInProgress() {
		const state = newMachineState();
		enqueue(state, { copper: 6 }, "smelt_copper", 2, 0, 10);
		const base = craftSeconds("smelt_copper", 1);
		advance(state, base / 2);
		setSpeedLevel(state, MACHINE_UPGRADES.furnace.speed.size(), base / 2);
		const fast = craftSeconds("smelt_copper", state.speedLevel);
		// Half done stays half done: the rest takes half of the NEW craft time, not nothing.
		const progress = machineProgress(state, base / 2);
		Assert.true(math.abs(progress.fraction - 0.5) < 0.0001);
		Assert.true(math.abs(progress.secondsLeft - fast / 2) < 0.0001);
		Assert.equal(advance(state, base / 2 + fast / 2 - 0.01), 0);
		Assert.equal(advance(state, base / 2 + fast / 2 + 0.01), 1);
	}

	@Test
	public speedUpgradeNeverChangesTheTotalOutput() {
		const upgraded = newMachineState();
		const plain = newMachineState();
		enqueue(upgraded, { copper: 9 }, "smelt_copper", 3, 0, 10);
		enqueue(plain, { copper: 9 }, "smelt_copper", 3, 0, 10);
		advance(upgraded, 4);
		setSpeedLevel(upgraded, 3, 4);
		advance(plain, 4);
		advance(upgraded, 1000);
		advance(plain, 1000);
		Assert.equal(upgraded.queue.size(), 0);
		Assert.equal(upgraded.ready.copper_ingot, plain.ready.copper_ingot);
	}

	@Test
	public speedUpgradeOnAnIdleOrBrokenMachineIsSafe() {
		const idle = newMachineState();
		setSpeedLevel(idle, 2, 100);
		Assert.equal(idle.speedLevel, 2);
		const broken = newMachineState();
		enqueue(broken, { copper: 3 }, "smelt_copper", 1, 0, 10);
		// A start time in the future (bad save): the share is clamped, never negative or above 1.
		broken.startedAt = 5000;
		setSpeedLevel(broken, 2, 10);
		Assert.true(broken.startedAt <= 10);
		Assert.true(broken.startedAt === broken.startedAt);
	}

	@Test
	public enqueueRespectsAHigherQueueLimit() {
		const state = newMachineState();
		const big = queueLimitOf("furnace", MACHINE_UPGRADES.furnace.queue.size());
		const result = enqueue(state, { copper: 3 * big }, "smelt_copper", big, 0, big);
		Assert.true(result.ok);
		Assert.equal(state.queue.size(), big);
	}
}

export = FactoryTests;
