// Pure rules of the tycoon line (decisions 027). No Roblox API here, so everything is unit tested.
// The line is a chain of owned machines; each has a FIFO queue of ore ids waiting for it. An item in the queue of
// machine i has stage i (it passed machines 0..i-1). The last owned machine sells what it makes.
import {
	HOPPER_CAPACITY,
	LINE_MACHINES,
	LINE_MAX_STEP,
	LINE_UPGRADES,
	LineMachineDef,
	LineUpgradeTrack,
	OFFLINE_MAX_SECONDS,
	OFFLINE_SPEED,
	STAGE_VALUE,
	isLineUpgradeTrack,
} from "shared/config/line";

export interface LineMachineState {
	/** Upgrade levels, 1-based. */
	speed: number;
	duplicate: number;
	quality: number;
	capacity: number;
	/** Seconds of work done on the item at the front of the queue. */
	progress: number;
	/** Ore ids waiting for this machine, front first. */
	queue: string[];
}

/** Machines bought so far, in line order. Their number is the next machine to buy. */
export interface LineState {
	machines: LineMachineState[];
}

/** Base value of a raw ore, or undefined for an unknown id (that item is dropped, never sold). */
export type OreValueOf = (ore: string) => number | undefined;

/** Random number in [0, 1). Passed in so tests are deterministic. */
export type RandomFn = () => number;

export function newLineState(): LineState {
	return { machines: [] };
}

function newMachine(): LineMachineState {
	return { speed: 1, duplicate: 1, quality: 1, capacity: 1, progress: 0, queue: [] };
}

function isFiniteNumber(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

// ---- buying machines ----

/** The next machine to buy, or undefined when the whole line is owned. */
export function nextLineMachine(state: LineState): LineMachineDef | undefined {
	return LINE_MACHINES[state.machines.size()];
}

export type BuyLineMachineResult =
	| { readonly ok: true; readonly def: LineMachineDef; readonly money: number }
	| { readonly ok: false; readonly reason: "complete" | "not-enough-money" };

/** Decides a purchase of the next machine. Does not change anything; apply with `applyBuyLineMachine`. */
export function tryBuyLineMachine(state: LineState, money: number): BuyLineMachineResult {
	const def = nextLineMachine(state);
	if (def === undefined) {
		return { ok: false, reason: "complete" };
	}
	if (!(money >= def.price)) {
		return { ok: false, reason: "not-enough-money" };
	}
	return { ok: true, def, money: money - def.price };
}

export function applyBuyLineMachine(state: LineState): void {
	if (nextLineMachine(state) !== undefined) {
		state.machines.push(newMachine());
	}
}

// ---- upgrades ----

/** The value of a track at a level; out-of-range levels are clamped to the table. */
export function upgradeValue(track: LineUpgradeTrack, level: number): number {
	const levels = LINE_UPGRADES[track];
	const index = math.clamp(isFiniteNumber(level) ? math.floor(level) : 1, 1, levels.size()) - 1;
	return levels[index].value;
}

export interface NextLineUpgrade {
	readonly level: number;
	readonly price: number;
	readonly value: number;
}

/** The next level of a track for an owned machine, or undefined (maxed, unknown machine or track). */
export function nextLineUpgrade(state: LineState, index: unknown, track: unknown): NextLineUpgrade | undefined {
	if (!isFiniteNumber(index) || !isLineUpgradeTrack(track)) {
		return undefined;
	}
	const machine = state.machines[index];
	const def = LINE_MACHINES[index];
	if (machine === undefined || def === undefined) {
		return undefined;
	}
	const step = LINE_UPGRADES[track][machine[track]];
	if (step === undefined) {
		return undefined;
	}
	return { level: machine[track] + 1, price: math.floor(def.price * step.priceFactor), value: step.value };
}

export type LineUpgradeResult =
	| { readonly ok: true; readonly upgrade: NextLineUpgrade; readonly money: number }
	| { readonly ok: false; readonly reason: "unknown" | "maxed" | "not-enough-money" };

/** Decides an upgrade. Does not change anything; apply with `applyLineUpgrade`. Safe on client input. */
export function tryLineUpgrade(state: LineState, index: unknown, track: unknown, money: number): LineUpgradeResult {
	if (!isFiniteNumber(index) || !isLineUpgradeTrack(track) || state.machines[index] === undefined) {
		return { ok: false, reason: "unknown" };
	}
	const upgrade = nextLineUpgrade(state, index, track);
	if (upgrade === undefined) {
		return { ok: false, reason: "maxed" };
	}
	if (!(money >= upgrade.price)) {
		return { ok: false, reason: "not-enough-money" };
	}
	return { ok: true, upgrade, money: money - upgrade.price };
}

export function applyLineUpgrade(state: LineState, index: number, track: LineUpgradeTrack): void {
	const machine = state.machines[index];
	if (machine !== undefined && machine[track] < LINE_UPGRADES[track].size()) {
		machine[track] += 1;
	}
}

// ---- queues ----

/** How many items may wait for machine `index`: the hopper for the first one, the capacity track for the rest. */
export function queueLimit(state: LineState, index: number): number {
	const machine = state.machines[index];
	if (machine === undefined) {
		return 0;
	}
	return index === 0 ? HOPPER_CAPACITY : upgradeValue("capacity", machine.capacity);
}

/**
 * Puts ore into the hopper, in the given order, up to its free space. Returns how many of each ore were taken,
 * so the caller removes exactly that from the bag. Needs at least one owned machine.
 */
export function depositOre(
	state: LineState,
	counts: { readonly [ore: string]: number | undefined },
	order: ReadonlyArray<string>,
): Map<string, number> {
	const taken = new Map<string, number>();
	const hopper = state.machines[0];
	if (hopper === undefined) {
		return taken;
	}
	let free = queueLimit(state, 0) - hopper.queue.size();
	for (const ore of order) {
		const raw = counts[ore];
		const have = isFiniteNumber(raw) && raw > 0 ? math.floor(raw) : 0;
		const amount = math.min(have, math.max(free, 0));
		for (let i = 0; i < amount; i++) {
			hopper.queue.push(ore);
		}
		if (amount > 0) {
			taken.set(ore, amount);
			free -= amount;
		}
	}
	return taken;
}

// ---- value ----

/**
 * Sale value of one item of `ore` that left machine `lastIndex` (so its stage is lastIndex + 1): base value x stage
 * multiplier x the quality bonus of every machine it passed. Undefined for an unknown ore.
 */
export function itemValue(state: LineState, ore: string, lastIndex: number, valueOf: OreValueOf): number | undefined {
	const base = valueOf(ore);
	const stage = STAGE_VALUE[lastIndex + 1];
	if (base === undefined || !isFiniteNumber(base) || base < 0 || stage === undefined) {
		return undefined;
	}
	let value = base * stage;
	for (let i = 0; i <= lastIndex; i++) {
		const machine = state.machines[i];
		if (machine !== undefined) {
			value *= upgradeValue("quality", machine.quality);
		}
	}
	return value;
}

// ---- processing ----

export interface LineTickResult {
	/** Money from items sold at the end of the line (whole dollars). */
	readonly money: number;
	/** Items sold. */
	readonly sold: number;
}

/**
 * Advances the line by `seconds` (clamped to [0, LINE_MAX_STEP]). Machines run downstream first, so an item moves
 * at most one machine per step and a machine sees the space freed by the next one. A machine whose next queue is
 * full stops (keeps its item), it never throws ore away.
 */
export function advanceLine(state: LineState, seconds: number, valueOf: OreValueOf, random: RandomFn): LineTickResult {
	const dt = isFiniteNumber(seconds) ? math.clamp(seconds, 0, LINE_MAX_STEP) : 0;
	const last = state.machines.size() - 1;
	let money = 0;
	let sold = 0;
	for (let i = last; i >= 0; i--) {
		const machine = state.machines[i];
		const def = LINE_MACHINES[i];
		if (def === undefined) {
			continue;
		}
		if (machine.queue.size() === 0) {
			machine.progress = 0;
			continue;
		}
		const seconds = def.seconds;
		machine.progress += dt * upgradeValue("speed", machine.speed);
		while (machine.progress >= seconds && machine.queue.size() > 0) {
			const outputs = random() < upgradeValue("duplicate", machine.duplicate) ? 2 : 1;
			if (i === last) {
				const ore = machine.queue.remove(0) as string;
				const value = itemValue(state, ore, i, valueOf);
				if (value !== undefined) {
					money += math.round(value * outputs);
					sold += outputs;
				}
			} else {
				const target = state.machines[i + 1];
				const room = queueLimit(state, i + 1) - target.queue.size();
				if (room <= 0) {
					machine.progress = seconds; // stalled: ready to go as soon as there is room
					break;
				}
				const ore = machine.queue.remove(0) as string;
				for (let n = 0; n < math.min(outputs, room); n++) {
					target.queue.push(ore);
				}
			}
			machine.progress -= seconds;
		}
		if (machine.queue.size() === 0) {
			machine.progress = 0; // no banking of idle time
		}
	}
	return { money, sold };
}

/**
 * What the line made while the player was away: `elapsed` real seconds (capped at OFFLINE_MAX_SECONDS) run at
 * OFFLINE_SPEED, in steps of LINE_MAX_STEP. Broken input (negative, NaN, clock went back) counts as no time.
 */
export function advanceOffline(
	state: LineState,
	elapsed: number,
	valueOf: OreValueOf,
	random: RandomFn,
): LineTickResult {
	const real = isFiniteNumber(elapsed) ? math.clamp(elapsed, 0, OFFLINE_MAX_SECONDS) : 0;
	let remaining = real * OFFLINE_SPEED;
	let money = 0;
	let sold = 0;
	while (remaining > 0) {
		const step = math.min(remaining, LINE_MAX_STEP);
		const result = advanceLine(state, step, valueOf, random);
		money += result.money;
		sold += result.sold;
		remaining -= step;
		if (isLineIdle(state)) {
			break; // nothing left to process: the rest of the time changes nothing
		}
	}
	return { money, sold };
}

/** True when no machine has anything to do. */
export function isLineIdle(state: LineState): boolean {
	return state.machines.every((machine) => machine.queue.size() === 0);
}

// ---- what the prompt at a machine does ----

export type MachineAction =
	| { readonly kind: "buy"; readonly price: number }
	| { readonly kind: "locked" }
	| { readonly kind: "deposit" }
	| { readonly kind: "upgrade" };

/**
 * What the prompt at machine `index` (0-based) does for this line: the next machine is for sale, later ones are
 * locked (machines are bought in order), the first owned one takes ore from the bag, other owned ones open upgrades.
 */
export function machineAction(state: LineState, index: number): MachineAction {
	const owned = state.machines.size();
	const def = LINE_MACHINES[index];
	if (def === undefined || index < 0 || index !== math.floor(index)) {
		return { kind: "locked" };
	}
	if (index === owned) {
		return { kind: "buy", price: def.price };
	}
	if (index > owned) {
		return { kind: "locked" };
	}
	return index === 0 ? { kind: "deposit" } : { kind: "upgrade" };
}

/** Line income after the sell bonus (pets), in whole dollars. A broken multiplier counts as 1. */
export function lineIncome(money: number, multiplier: number): number {
	const safe = isFiniteNumber(multiplier) && multiplier > 0 ? multiplier : 1;
	return isFiniteNumber(money) && money > 0 ? math.floor(money * safe) : 0;
}
