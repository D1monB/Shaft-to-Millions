// Pure auto-drill rules: production over time (online and capped offline), the buffer, and delivery to
// the hopper of the player's line by conveyor (decisions 027). Time is passed in as unix seconds.
import { DRILLS, DRILL_LEVELS, DrillLevel, MAX_OFFLINE_DRILL_SECONDS } from "shared/config/drills";
import { ORES, OreId } from "shared/config/ores";
import { LineState, depositOre } from "shared/features/line";

export interface DrillState {
	oreId: OreId;
	/** When production was last counted. */
	lastTick: number;
	/** Seconds already worked toward the next piece. */
	progress: number;
	/** Pieces waiting for space in the line hopper (the start of the belt). */
	buffer: number;
	/** Upgrade level, 1-based (decision 059). */
	level: number;
}

export function newDrillState(oreId: OreId, now: number): DrillState {
	return { oreId, lastTick: now, progress: 0, buffer: 0, level: 1 };
}

/** The level entry for a (possibly broken) level number; clamped to the table. */
export function drillLevelOf(level: number): DrillLevel {
	const index = level === level && level < math.huge ? math.clamp(math.floor(level), 1, DRILL_LEVELS.size()) : 1;
	return DRILL_LEVELS[index - 1];
}

/** Pieces the drill of `layer` holds at `level`. 0 for a layer without a drill. */
export function drillBuffer(layer: number, level: number): number {
	const def = DRILLS[layer];
	return def === undefined ? 0 : math.floor(def.bufferCapacity * drillLevelOf(level).buffer);
}

export type DrillUpgradeResult =
	| { readonly ok: true; readonly level: number; readonly money: number }
	| { readonly ok: false; readonly reason: "unknown" | "maxed" | "not-enough-money" };

/** The price of the next level of this drill, or undefined at the top (or for a layer without a drill). */
export function nextDrillLevelPrice(state: DrillState, layer: number): number | undefined {
	const def = DRILLS[layer];
	const current = math.clamp(state.level === state.level ? math.floor(state.level) : 1, 1, DRILL_LEVELS.size());
	const step = DRILL_LEVELS[current];
	return def === undefined || step === undefined ? undefined : math.floor(def.price * step.priceFactor);
}

/** Decides a drill upgrade. Does not change anything; the caller sets the level and the money together. */
export function tryUpgradeDrill(state: DrillState, layer: number, money: number): DrillUpgradeResult {
	if (DRILLS[layer] === undefined) {
		return { ok: false, reason: "unknown" };
	}
	const price = nextDrillLevelPrice(state, layer);
	if (price === undefined) {
		return { ok: false, reason: "maxed" };
	}
	if (!(money >= price)) {
		return { ok: false, reason: "not-enough-money" };
	}
	return { ok: true, level: math.floor(state.level) + 1, money: money - price };
}

/** A layer is "passed" when the player reached the camp of the layer below it. */
export function isDrillUnlocked(layer: number, deepestLayer: number): boolean {
	return DRILLS[layer] !== undefined && deepestLayer > layer;
}

/** The drill can only drill what the player could mine by hand: the right layer and a good enough pickaxe. */
export function canDrillOre(layer: number, oreId: OreId, pickaxeTier: number): boolean {
	const ore = ORES[oreId];
	return ore.layer === layer && ore.requiredTier <= pickaxeTier && ore.drillable !== false;
}

export function secondsPerPiece(layer: number, oreId: OreId, level = 1): number {
	const def = DRILLS[layer];
	return def === undefined ? math.huge : (ORES[oreId].hardness * def.secondsPerHardness) / drillLevelOf(level).speed;
}

/**
 * Counts production since `lastTick` into the buffer. Returns pieces produced.
 * Elapsed time is clamped to [0, MAX_OFFLINE_DRILL_SECONDS]: a clock going backwards gives nothing and
 * a very long absence counts only up to the cap. A full buffer stops the drill (no progress builds up).
 */
export function advanceDrill(state: DrillState, layer: number, now: number): number {
	const def = DRILLS[layer];
	const elapsed = math.clamp(now - state.lastTick, 0, MAX_OFFLINE_DRILL_SECONDS);
	state.lastTick = math.max(state.lastTick, now);
	if (def === undefined || elapsed !== elapsed) {
		return 0;
	}
	const capacity = drillBuffer(layer, state.level);
	const room = capacity - state.buffer;
	if (room <= 0) {
		state.progress = 0;
		return 0;
	}
	const perPiece = secondsPerPiece(layer, state.oreId, state.level);
	const worked = state.progress + elapsed;
	const produced = math.min(math.floor(worked / perPiece), room);
	state.buffer += produced;
	state.progress = state.buffer >= capacity ? 0 : worked - produced * perPiece;
	return produced;
}

/** Conveyor: moves the buffer onto the start of the belt as far as it has room. Returns pieces moved. */
export function deliverDrill(state: DrillState, line: LineState): number {
	const moved = depositOre(line, { [state.oreId]: state.buffer }, [state.oreId]).get(state.oreId) ?? 0;
	state.buffer -= moved;
	return moved;
}

/** Switching ore resets work in progress. Only allowed with an empty buffer, so no ore changes type. */
export function selectDrillOre(state: DrillState, oreId: OreId, now: number): boolean {
	if (state.buffer > 0) {
		return false;
	}
	state.oreId = oreId;
	state.progress = 0;
	state.lastTick = now;
	return true;
}
