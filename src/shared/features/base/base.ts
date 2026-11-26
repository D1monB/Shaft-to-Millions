// Pure base-building rules (decision 063). The server passes in the unix time, so timers are fully unit tested.
// Nothing here changes money or crystals: the "try" functions return the new balances and the caller writes them
// together with the state, with no yield in between.
import {
	BUILDER_CRYSTAL_PRICES,
	BUILDINGS,
	BUILDING_IDS,
	BuildingId,
	BuildingLevel,
	MAIN_BUILDING,
	SKIP_SECONDS_PER_CRYSTAL,
	isBuildingId,
} from "shared/config/base";
import { OFFLINE_MAX_SECONDS } from "shared/config/line";
import { isFiniteNumber } from "shared/lib/validate";

export interface BuildJob {
	id: BuildingId;
	/** Unix time the new level is ready. */
	finishAt: number;
}

export interface BaseState {
	/** Finished level per building; 0 = not built. */
	levels: { [K in BuildingId]: number };
	jobs: BuildJob[];
	/** How many things may be built at once. */
	builders: number;
}

export const MAX_BUILDERS = 1 + BUILDER_CRYSTAL_PRICES.size();

export function newBaseState(): BaseState {
	return { levels: { office: 0, market: 0, warehouse: 0, workshop: 0, lab: 0, hut: 0 }, jobs: [], builders: 1 };
}

export function levelOf(state: BaseState, id: BuildingId): number {
	const level = state.levels[id];
	return isFiniteNumber(level) ? math.clamp(math.floor(level), 0, BUILDINGS[id].levels.size()) : 0;
}

export function jobOf(state: BaseState, id: BuildingId): BuildJob | undefined {
	return state.jobs.find((job) => job.id === id);
}

/** Seconds left of a running build; 0 when there is none (or it is due). */
export function secondsLeft(state: BaseState, id: BuildingId, now: number): number {
	const job = jobOf(state, id);
	if (job === undefined || !isFiniteNumber(job.finishAt) || !isFiniteNumber(now)) {
		return 0;
	}
	return math.max(0, job.finishAt - now);
}

/** The level being built next, or undefined at the top. */
export function nextBuildingLevel(state: BaseState, id: BuildingId): (BuildingLevel & { level: number }) | undefined {
	const current = levelOf(state, id);
	const step = BUILDINGS[id].levels[current];
	return step === undefined ? undefined : { ...step, level: current + 1 };
}

/** The office level a building level needs: itself never higher than the office (the office needs nothing). */
export function officeNeeded(id: BuildingId, level: number): number {
	return id === MAIN_BUILDING ? 0 : level;
}

export type BuildRefusal = "unknown" | "maxed" | "busy" | "no-builder" | "office" | "not-enough-money";

export type StartBuildResult =
	| { readonly ok: true; readonly money: number; readonly finishAt: number; readonly level: number }
	| { readonly ok: false; readonly reason: BuildRefusal; readonly office?: number };

/** Decides a build start. On success the caller subtracts the money and calls `applyStart` in the same frame. */
export function tryStartBuild(state: BaseState, id: unknown, money: number, now: number): StartBuildResult {
	if (!isBuildingId(id) || !isFiniteNumber(now) || now <= 0) {
		return { ok: false, reason: "unknown" };
	}
	if (jobOf(state, id) !== undefined) {
		return { ok: false, reason: "busy" };
	}
	const step = nextBuildingLevel(state, id);
	if (step === undefined) {
		return { ok: false, reason: "maxed" };
	}
	const office = officeNeeded(id, step.level);
	if (levelOf(state, MAIN_BUILDING) < office) {
		return { ok: false, reason: "office", office };
	}
	if (state.jobs.size() >= math.clamp(state.builders, 1, MAX_BUILDERS)) {
		return { ok: false, reason: "no-builder" };
	}
	if (!(money >= step.price)) {
		return { ok: false, reason: "not-enough-money" };
	}
	return { ok: true, money: money - step.price, finishAt: now + step.seconds, level: step.level };
}

export function applyStart(state: BaseState, id: BuildingId, finishAt: number): void {
	state.jobs.push({ id, finishAt });
}

/** Finishes every due job (raising its level) and returns the finished buildings. */
export function completeJobs(state: BaseState, now: number): BuildingId[] {
	const done: BuildingId[] = [];
	if (!isFiniteNumber(now)) {
		return done;
	}
	const pending: BuildJob[] = [];
	for (const job of state.jobs) {
		if (job.finishAt <= now) {
			state.levels[job.id] = math.min(levelOf(state, job.id) + 1, BUILDINGS[job.id].levels.size());
			done.push(job.id);
		} else {
			pending.push(job);
		}
	}
	state.jobs = pending;
	return done;
}

/** Crystals to finish a build now: one per SKIP_SECONDS_PER_CRYSTAL left, at least one. */
export function skipCost(left: number): number {
	if (!isFiniteNumber(left) || left <= 0) {
		return 0;
	}
	return math.max(1, math.ceil(left / SKIP_SECONDS_PER_CRYSTAL));
}

export type SkipResult =
	| { readonly ok: true; readonly crystals: number; readonly cost: number }
	| { readonly ok: false; readonly reason: "unknown" | "not-building" | "not-enough-crystals" };

/** Decides a skip. On success the caller sets the crystals and calls `applySkip` in the same frame. */
export function trySkip(state: BaseState, id: unknown, crystals: number, now: number): SkipResult {
	if (!isBuildingId(id)) {
		return { ok: false, reason: "unknown" };
	}
	const cost = skipCost(secondsLeft(state, id, now));
	if (cost <= 0) {
		return { ok: false, reason: "not-building" };
	}
	if (!(crystals >= cost)) {
		return { ok: false, reason: "not-enough-crystals" };
	}
	return { ok: true, crystals: crystals - cost, cost };
}

/** Makes the job due; `completeJobs` then raises the level. */
export function applySkip(state: BaseState, id: BuildingId, now: number): void {
	const job = jobOf(state, id);
	if (job !== undefined) {
		job.finishAt = now;
	}
}

/** The price of the next builder, or undefined when all are hired. */
export function nextBuilderPrice(state: BaseState): number | undefined {
	return BUILDER_CRYSTAL_PRICES[math.clamp(state.builders, 1, MAX_BUILDERS) - 1];
}

export type HireResult =
	| { readonly ok: true; readonly crystals: number }
	| { readonly ok: false; readonly reason: "maxed" | "not-enough-crystals" };

export function tryHireBuilder(state: BaseState, crystals: number): HireResult {
	const price = nextBuilderPrice(state);
	if (price === undefined) {
		return { ok: false, reason: "maxed" };
	}
	if (!(crystals >= price)) {
		return { ok: false, reason: "not-enough-crystals" };
	}
	return { ok: true, crystals: crystals - price };
}

export interface BaseEffects {
	/** Added to money from sales and the line (0.1 = +10%). */
	readonly sellBonus: number;
	/** Offline line production cap in seconds. */
	readonly offlineSeconds: number;
	/** How many times faster the line runs. */
	readonly lineSpeed: number;
	/** Extra seconds per crystal booster portion. */
	readonly boostSeconds: number;
	/** Added to ore from every hit. */
	readonly oreBonus: number;
}

function bonusOf(state: BaseState, id: BuildingId): number {
	return levelOf(state, id) * BUILDINGS[id].perLevel;
}

export function baseEffects(state: BaseState): BaseEffects {
	return {
		sellBonus: bonusOf(state, "market"),
		offlineSeconds: OFFLINE_MAX_SECONDS + bonusOf(state, "warehouse"),
		lineSpeed: 1 + bonusOf(state, "workshop"),
		boostSeconds: bonusOf(state, "lab"),
		oreBonus: bonusOf(state, "hut"),
	};
}

/** Total finished levels, e.g. for goals and quests. */
export function totalLevels(state: BaseState): number {
	let total = 0;
	for (const id of BUILDING_IDS) {
		total += levelOf(state, id);
	}
	return total;
}
