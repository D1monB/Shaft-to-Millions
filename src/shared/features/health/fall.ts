// Pure fall rules (decision 067): the server watches heights and hurts a hard landing. No Roblox API here.
import { FALL_DAMAGE_PER_STUD, FALL_MAX_DAMAGE, FALL_RESET_STEP, FALL_SAFE_HEIGHT } from "./tuning";

export interface FallState {
	/** Highest point since the character left the ground; undefined while standing. */
	peak?: number;
	lastY?: number;
}

/** Health lost for a drop of this many studs: nothing up to the safe height, then per stud, capped. */
export function fallDamage(drop: number): number {
	if (!(drop > FALL_SAFE_HEIGHT) || drop === math.huge) {
		return 0;
	}
	return math.min(FALL_MAX_DAMAGE, math.floor((drop - FALL_SAFE_HEIGHT) * FALL_DAMAGE_PER_STUD));
}

/**
 * One height sample. Returns the damage of a landing (0 otherwise). A jump between two samples bigger than
 * FALL_RESET_STEP is a teleport or a lift, not a fall: the state starts over.
 */
export function stepFall(state: FallState, y: number, grounded: boolean): number {
	if (y !== y || y === math.huge || y === -math.huge) {
		return 0;
	}
	const last = state.lastY;
	state.lastY = y;
	if (last !== undefined && math.abs(y - last) > FALL_RESET_STEP) {
		state.peak = undefined;
		return 0;
	}
	if (!grounded) {
		state.peak = math.max(state.peak ?? y, y);
		return 0;
	}
	const peak = state.peak;
	state.peak = undefined;
	return peak === undefined ? 0 : fallDamage(peak - y);
}
