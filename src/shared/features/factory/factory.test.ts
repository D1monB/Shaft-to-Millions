import { Assert, Test } from "@rbxts/lunit";
import { MACHINES, RECIPES, RECIPE_IDS, recipesOf } from "shared/config/machines";
import { RESOURCES } from "shared/config/resources";
import {
	Counts,
	advance,
	cancelLast,
	collect,
	depositAll,
	enqueue,
	machineProgress,
	maxCrafts,
	newMachineState,
	simulateProcessing,
	storageTotal,
} from "./factory";

const LIMIT = MACHINES.furnace.queueLimit;

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
}

export = FactoryTests;
