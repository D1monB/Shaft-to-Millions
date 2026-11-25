// Pure auto-drill rules: production over time (online and capped offline), the buffer, and delivery to
// the hopper of the player's line by conveyor (decisions 027). Time is passed in as unix seconds.
import { DRILLS, MAX_OFFLINE_DRILL_SECONDS } from "shared/config/drills";
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
}

export function newDrillState(oreId: OreId, now: number): DrillState {
	return { oreId, lastTick: now, progress: 0, buffer: 0 };
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

export function secondsPerPiece(layer: number, oreId: OreId): number {
	const def = DRILLS[layer];
	return def === undefined ? math.huge : ORES[oreId].hardness * def.secondsPerHardness;
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
	const room = def.bufferCapacity - state.buffer;
	if (room <= 0) {
		state.progress = 0;
		return 0;
	}
	const perPiece = secondsPerPiece(layer, state.oreId);
	const worked = state.progress + elapsed;
	const produced = math.min(math.floor(worked / perPiece), room);
	state.buffer += produced;
	state.progress = state.buffer >= def.bufferCapacity ? 0 : worked - produced * perPiece;
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
