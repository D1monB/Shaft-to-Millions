// Pure rules of the tycoon line (decisions 027). No Roblox API here, so everything is unit tested.
// The belt always exists: ore dropped at its start waits in the intake. Bought machines sit on the belt in order; each
// has a FIFO queue of ore ids waiting for it. An item in the queue of machine i has stage i (it passed machines
// 0..i-1). What leaves the last bought machine falls into the SellStation; with no machine the raw ore rides the belt
// to the SellStation at BELT_SECONDS_PER_ITEM each.
import {
	BELT_LEVELS,
	BELT_SECONDS_PER_ITEM,
	BeltTrack,
	BeltTrackLevel,
	POLISH_LEVELS,
	SILO_LEVELS,
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

export interface LineState {
	/** Ore dropped at the start of the belt, front first. */
	intake: string[];
	/** Seconds of belt travel toward the next raw sale (only used while no machine is bought). */
	beltProgress: number;
	/** Machines bought so far, in line order. Their number is the next machine to buy. */
	machines: LineMachineState[];
	/** Conveyor level, 1-based (decision 054): speeds up the whole line. */
	beltLevel: number;
	/** Silo level, 1-based (decision 069): how much ore may wait at the start of the belt. */
	siloLevel: number;
	/** Polish level, 1-based (decision 069): money bonus of what the line sells. */
	polishLevel: number;
}

/** Base value of a raw ore, or undefined for an unknown id (that item is dropped, never sold). */
export type OreValueOf = (ore: string) => number | undefined;

/** Random number in [0, 1). Passed in so tests are deterministic. */
export type RandomFn = () => number;

export function newLineState(): LineState {
	return { intake: [], beltProgress: 0, machines: [], beltLevel: 1, siloLevel: 1, polishLevel: 1 };
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

// ---- conveyor ----

/** How many times faster the whole line runs at this conveyor level; broken levels are clamped to the table. */
export function beltSpeed(level: number): number {
	const index = math.clamp(isFiniteNumber(level) ? math.floor(level) : 1, 1, BELT_LEVELS.size()) - 1;
	return BELT_LEVELS[index].speed;
}

/** The levels of one belt track as {price, value}. */
export function beltTrackLevels(track: BeltTrack): ReadonlyArray<BeltTrackLevel> {
	if (track === "capacity") {
		return SILO_LEVELS;
	}
	return track === "polish" ? POLISH_LEVELS : BELT_LEVELS.map((step) => ({ price: step.price, value: step.speed }));
}

/** The state field a belt track is saved in. */
export const BELT_TRACK_FIELD = { speed: "beltLevel", capacity: "siloLevel", polish: "polishLevel" } as const;

/** The current level (1-based, clamped) and value of a belt track. */
export function beltTrackNow(state: LineState, track: BeltTrack): { level: number; value: number } {
	const levels = beltTrackLevels(track);
	const raw = state[BELT_TRACK_FIELD[track]];
	const level = math.clamp(isFiniteNumber(raw) ? math.floor(raw) : 1, 1, levels.size());
	return { level, value: levels[level - 1].value };
}

/** The next level of a belt track and its price, or undefined at the top. */
export function nextBeltLevel(
	state: LineState,
	track: BeltTrack = "speed",
): (BeltTrackLevel & { readonly level: number }) | undefined {
	const current = beltTrackNow(state, track).level;
	const step = beltTrackLevels(track)[current];
	return step === undefined ? undefined : { level: current + 1, price: step.price, value: step.value };
}

/** How many items may wait at the start of the belt. */
export function hopperCapacity(state: LineState): number {
	return beltTrackNow(state, "capacity").value;
}

export type BeltUpgradeResult =
	| { readonly ok: true; readonly level: number; readonly money: number }
	| { readonly ok: false; readonly reason: "maxed" | "not-enough-money" };

/** Decides a belt upgrade. Does not change anything; the caller sets the level and the money together. */
export function tryBeltUpgrade(state: LineState, money: number, track: BeltTrack = "speed"): BeltUpgradeResult {
	const step = nextBeltLevel(state, track);
	if (step === undefined) {
		return { ok: false, reason: "maxed" };
	}
	if (!(money >= step.price)) {
		return { ok: false, reason: "not-enough-money" };
	}
	return { ok: true, level: step.level, money: money - step.price };
}

// ---- queues ----

/** How many items may wait for machine `index` (its capacity level). 0 for a machine not bought. */
export function queueLimit(state: LineState, index: number): number {
	const machine = state.machines[index];
	return machine === undefined ? 0 : upgradeValue("capacity", machine.capacity);
}

/** Free room at the start of the belt. */
export function intakeRoom(state: LineState): number {
	return math.max(hopperCapacity(state) - state.intake.size(), 0);
}

/**
 * Puts ore at the start of the belt, in the given order, up to its free room. Returns how many of each ore were
 * taken, so the caller removes exactly that from the bag. Works with or without machines (the belt always exists).
 */
export function depositOre(
	state: LineState,
	counts: { readonly [ore: string]: number | undefined },
	order: ReadonlyArray<string>,
): Map<string, number> {
	const taken = new Map<string, number>();
	let free = intakeRoom(state);
	for (const ore of order) {
		const raw = counts[ore];
		const have = isFiniteNumber(raw) && raw > 0 ? math.floor(raw) : 0;
		const amount = math.min(have, math.max(free, 0));
		for (let i = 0; i < amount; i++) {
			state.intake.push(ore);
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
 * Sale value of one item of `ore` that left machine `lastIndex` (so its stage is lastIndex + 1; -1 = raw ore straight
 * off the belt): base value x stage multiplier x (1 + the quality bonuses of every machine it passed, ADDED, decision
 * 056). Undefined for an unknown ore.
 */
export function itemValue(state: LineState, ore: string, lastIndex: number, valueOf: OreValueOf): number | undefined {
	const base = valueOf(ore);
	const stage = STAGE_VALUE[lastIndex + 1];
	if (base === undefined || !isFiniteNumber(base) || base < 0 || stage === undefined) {
		return undefined;
	}
	let bonus = 0;
	for (let i = 0; i <= lastIndex; i++) {
		const machine = state.machines[i];
		if (machine !== undefined) {
			bonus += upgradeValue("quality", machine.quality);
		}
	}
	return base * stage * (1 + bonus) * (1 + beltTrackNow(state, "polish").value);
}

// ---- processing ----

/**
 * One item leaving a place on the line, for the belt visuals only (the money never depends on it).
 * `from` = -1: raw ore leaving the start of the belt; `from` = i: an item leaving machine i (its stage is i + 1).
 */
export interface LineMove {
	readonly ore: string;
	readonly from: number;
}

/**
 * At most this many moves are reported per step: a visual hint, not a log. It keeps one LineFlow message well under
 * the ~900 byte limit of an UnreliableRemoteEvent (larger messages are dropped whole).
 */
export const MAX_LINE_MOVES = 24;

function report(moves: LineMove[] | undefined, ore: string, from: number): void {
	if (moves !== undefined && moves.size() < MAX_LINE_MOVES) {
		moves.push({ ore, from });
	}
}

export interface LineTickResult {
	/** Money from items sold at the end of the line (whole dollars). */
	readonly money: number;
	/** Items sold. */
	readonly sold: number;
}

/**
 * Advances the line by `seconds` (clamped to [0, LINE_MAX_STEP]). Machines run downstream first, so an item moves
 * at most one machine per step and a machine sees the space freed by the next one. A machine whose next queue is
 * full stops (keeps its item), it never throws ore away. Before the machines, the intake feeds the first machine, or
 * with no machine the raw ore rides the belt to the SellStation.
 * @param moves optional list that receives what left where in this step (belt visuals)
 */
export function advanceLine(
	state: LineState,
	seconds: number,
	valueOf: OreValueOf,
	random: RandomFn,
	moves?: LineMove[],
): LineTickResult {
	// The conveyor level speeds up everything on the line: the belt and every machine.
	const dt = (isFiniteNumber(seconds) ? math.clamp(seconds, 0, LINE_MAX_STEP) : 0) * beltSpeed(state.beltLevel);
	// The intake first: ore just dropped on the belt reaches the first machine in the same step.
	const raw = feedFromIntake(state, dt, valueOf, moves);
	const last = state.machines.size() - 1;
	let money = raw.money;
	let sold = raw.sold;
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
				report(moves, ore, i);
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
				report(moves, ore, i);
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

/** The intake: ore moves onto the first machine as far as its queue has room, or sells raw without machines. */
function feedFromIntake(state: LineState, dt: number, valueOf: OreValueOf, moves?: LineMove[]): LineTickResult {
	const first = state.machines[0];
	if (first !== undefined) {
		state.beltProgress = 0;
		const room = queueLimit(state, 0) - first.queue.size();
		for (let n = 0; n < room && state.intake.size() > 0; n++) {
			const ore = state.intake.remove(0) as string;
			report(moves, ore, -1);
			first.queue.push(ore);
		}
		return { money: 0, sold: 0 };
	}
	if (state.intake.size() === 0) {
		state.beltProgress = 0;
		return { money: 0, sold: 0 };
	}
	let money = 0;
	let sold = 0;
	state.beltProgress += dt;
	while (state.beltProgress >= BELT_SECONDS_PER_ITEM && state.intake.size() > 0) {
		const ore = state.intake.remove(0) as string;
		report(moves, ore, -1);
		const value = itemValue(state, ore, -1, valueOf);
		if (value !== undefined) {
			money += math.round(value);
			sold += 1;
		}
		state.beltProgress -= BELT_SECONDS_PER_ITEM;
	}
	if (state.intake.size() === 0) {
		state.beltProgress = 0;
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
	/** The base's workshop speeds the line up; broken input counts as 1. */
	speed = 1,
): LineTickResult {
	const factor = isFiniteNumber(speed) && speed >= 1 ? math.min(speed, 3) : 1;
	const real = isFiniteNumber(elapsed) ? math.clamp(elapsed, 0, OFFLINE_MAX_SECONDS) : 0;
	let remaining = real * OFFLINE_SPEED * factor;
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

/** True when nothing is on the belt or waiting for a machine. */
export function isLineIdle(state: LineState): boolean {
	return state.intake.size() === 0 && state.machines.every((machine) => machine.queue.size() === 0);
}

// ---- what the prompt at a machine does ----

export type MachineAction =
	{ readonly kind: "buy"; readonly price: number } | { readonly kind: "locked" } | { readonly kind: "upgrade" };

/**
 * What the prompt at machine `index` (0-based) does for this line: the next machine is for sale, later ones are
 * locked (machines are bought in order), owned ones open upgrades. Dropping ore is the intake's own prompt.
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
	return { kind: "upgrade" };
}

/** Line income after the sell bonus (pets), in whole dollars. A broken multiplier counts as 1. */
export function lineIncome(money: number, multiplier: number): number {
	const safe = isFiniteNumber(multiplier) && multiplier > 0 ? multiplier : 1;
	return isFiniteNumber(money) && money > 0 ? math.floor(money * safe) : 0;
}
