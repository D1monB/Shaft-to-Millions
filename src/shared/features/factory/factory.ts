// Pure factory rules: warehouse storage, machine queues and the "what if I process it" estimate.
// Time is always passed in (`now`, unix seconds), so queues keep running while the player is offline:
// on the next load we simply advance to the current time.
import { RECIPES, RecipeId, ResourceAmounts } from "shared/config/machines";
import { RESOURCES, RESOURCE_IDS, ResourceId } from "shared/config/resources";

/** Resource counts by id. Missing id = 0. */
export type Counts = { [K in ResourceId]?: number };

export interface MachineState {
	/** Crafts in order. queue[0] is in progress since `startedAt`. */
	queue: RecipeId[];
	startedAt: number;
	/** Finished output waiting to be collected into the warehouse. */
	ready: Counts;
}

export function newMachineState(): MachineState {
	return { queue: [], startedAt: 0, ready: {} };
}

// ---------------------------------------------------------------- storage

export function storageTotal(counts: Counts): number {
	let total = 0;
	for (const id of RESOURCE_IDS) {
		total += counts[id] ?? 0;
	}
	return total;
}

export function storageFree(counts: Counts, capacity: number): number {
	return math.max(0, capacity - storageTotal(counts));
}

function take(counts: Counts, amounts: ResourceAmounts, times: number): void {
	for (const [id, amount] of pairs(amounts)) {
		const left = (counts[id] ?? 0) - amount * times;
		counts[id] = left > 0 ? left : undefined;
	}
}

function give(counts: Counts, amounts: ResourceAmounts, times: number): void {
	for (const [id, amount] of pairs(amounts)) {
		counts[id] = (counts[id] ?? 0) + amount * times;
	}
}

function amountTotal(amounts: ResourceAmounts): number {
	let total = 0;
	for (const [, amount] of pairs(amounts)) {
		total += amount;
	}
	return total;
}

/** How many times the recipe's inputs are available in `store`. */
export function maxCrafts(store: Counts, recipeId: RecipeId): number {
	let result = math.huge;
	for (const [id, amount] of pairs(RECIPES[recipeId].inputs)) {
		result = math.min(result, math.floor((store[id] ?? 0) / amount));
	}
	return result === math.huge ? 0 : result;
}

/**
 * Moves everything from `source` into `target` (ids in config order) until `capacity` is reached.
 * Returns the number of pieces moved. Used for "unload the bag into the warehouse".
 */
export function depositAll(
	source: { [id: string]: number | undefined },
	target: Counts,
	ids: ReadonlyArray<ResourceId>,
	capacity: number,
): number {
	let moved = 0;
	for (const id of ids) {
		const have = source[id] ?? 0;
		if (!(have > 0)) {
			continue;
		}
		const amount = math.min(math.floor(have), storageFree(target, capacity));
		if (amount <= 0) {
			break;
		}
		target[id] = (target[id] ?? 0) + amount;
		const left = have - amount;
		source[id] = left > 0 ? left : undefined;
		moved += amount;
	}
	return moved;
}

// ---------------------------------------------------------------- machine queue

/**
 * Finishes every craft whose time has come, moving output to `ready`. Returns how many finished.
 * Each next craft starts exactly when the previous one ended, so offline time is used fully.
 */
export function advance(state: MachineState, now: number): number {
	let finished = 0;
	while (state.queue.size() > 0) {
		const recipe = RECIPES[state.queue[0]];
		if (state.startedAt > now + recipe.seconds) {
			// Impossible future start (bad save or a server with a wrong clock): restart from now.
			state.startedAt = now;
		}
		const endsAt = state.startedAt + recipe.seconds;
		if (now < endsAt) {
			break;
		}
		give(state.ready, recipe.outputs, 1);
		state.queue.shift();
		state.startedAt = endsAt;
		finished += 1;
	}
	return finished;
}

export type EnqueueResult =
	| { readonly ok: true; readonly added: number }
	| { readonly ok: false; readonly reason: "queue-full" | "missing-inputs" | "bad-count" };

/**
 * Adds up to `count` crafts. Inputs are taken from the warehouse right away (reserved), so the same ore
 * can never be sold and smelted at once. Call `advance` first so finished crafts free their queue slots.
 */
export function enqueue(
	state: MachineState,
	store: Counts,
	recipeId: RecipeId,
	count: number,
	now: number,
	queueLimit: number,
): EnqueueResult {
	if (!(count >= 1) || count === math.huge) {
		return { ok: false, reason: "bad-count" };
	}
	const room = queueLimit - state.queue.size();
	if (room <= 0) {
		return { ok: false, reason: "queue-full" };
	}
	const added = math.min(math.floor(count), room, maxCrafts(store, recipeId));
	if (added <= 0) {
		return { ok: false, reason: "missing-inputs" };
	}
	if (state.queue.size() === 0) {
		state.startedAt = now;
	}
	take(store, RECIPES[recipeId].inputs, added);
	for (let i = 0; i < added; i++) {
		state.queue.push(recipeId);
	}
	return { ok: true, added };
}

/**
 * Removes the LAST queued craft (never the one in progress) and refunds its inputs, if they fit.
 * Lets a player fix a misclick without losing ore.
 */
export function cancelLast(state: MachineState, store: Counts, capacity: number): boolean {
	if (state.queue.size() < 2) {
		return false;
	}
	const recipeId = state.queue[state.queue.size() - 1];
	const inputs = RECIPES[recipeId].inputs;
	if (storageFree(store, capacity) < amountTotal(inputs)) {
		return false;
	}
	state.queue.pop();
	give(store, inputs, 1);
	return true;
}

/** Moves finished output into the warehouse, as much as fits. Returns pieces moved. */
export function collect(state: MachineState, store: Counts, capacity: number): number {
	return depositAll(state.ready as { [id: string]: number | undefined }, store, RESOURCE_IDS, capacity);
}

export interface MachineProgress {
	readonly current: RecipeId | undefined;
	/** 0..1 of the craft in progress. */
	readonly fraction: number;
	readonly secondsLeft: number;
	/** Until the whole queue is done. */
	readonly totalSecondsLeft: number;
}

export function machineProgress(state: MachineState, now: number): MachineProgress {
	const current = state.queue[0];
	if (current === undefined) {
		return { current: undefined, fraction: 0, secondsLeft: 0, totalSecondsLeft: 0 };
	}
	const seconds = RECIPES[current].seconds;
	const elapsed = math.clamp(now - state.startedAt, 0, seconds);
	let rest = 0;
	for (let i = 1; i < state.queue.size(); i++) {
		rest += RECIPES[state.queue[i]].seconds;
	}
	return {
		current,
		fraction: elapsed / seconds,
		secondsLeft: seconds - elapsed,
		totalSecondsLeft: seconds - elapsed + rest,
	};
}

// ---------------------------------------------------------------- "what if I process it"

function valueOf(amounts: ResourceAmounts): number {
	let value = 0;
	for (const [id, amount] of pairs(amounts)) {
		value += RESOURCES[id].price * amount;
	}
	return value;
}

export interface ProcessingEstimate {
	readonly crafts: number;
	readonly seconds: number;
	readonly valueBefore: number;
	readonly valueAfter: number;
}

const MAX_SIMULATED_CRAFTS = 2_000;

/**
 * Greedy estimate: repeatedly craft the recipe with the biggest gain that is possible with what is left.
 * Shown before selling, so the player can compare "sell now" with "process first".
 */
export function simulateProcessing(counts: Counts, recipeIds: ReadonlyArray<RecipeId>): ProcessingEstimate {
	const pool: Counts = {};
	let valueBefore = 0;
	for (const id of RESOURCE_IDS) {
		const amount = counts[id];
		if (amount !== undefined && amount > 0 && amount < math.huge) {
			pool[id] = math.floor(amount);
			valueBefore += math.floor(amount) * RESOURCES[id].price;
		}
	}
	const profitable = recipeIds
		.map((id) => ({ id, gain: valueOf(RECIPES[id].outputs) - valueOf(RECIPES[id].inputs) }))
		.filter((entry) => entry.gain > 0)
		.sort((a, b) => a.gain > b.gain);

	let crafts = 0;
	let seconds = 0;
	let valueAfter = valueBefore;
	while (crafts < MAX_SIMULATED_CRAFTS) {
		const entry = profitable.find((candidate) => maxCrafts(pool, candidate.id) > 0);
		if (entry === undefined) {
			break;
		}
		take(pool, RECIPES[entry.id].inputs, 1);
		give(pool, RECIPES[entry.id].outputs, 1);
		crafts += 1;
		seconds += RECIPES[entry.id].seconds;
		valueAfter += entry.gain;
	}
	return { crafts, seconds, valueBefore, valueAfter };
}
