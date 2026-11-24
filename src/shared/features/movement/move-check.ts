// Server-side movement check (anti-teleport / speedhack). Pure: the service reads the character and passes numbers,
// so every rule here runs under Lune in unit tests.
//
// How it works: we keep an ANCHOR, the last position we believe is honest. Each sample is compared with the anchor:
//   - within the allowance the sample is ok (and forgives one strike),
//   - a small excess is a "strike",
//   - a big excess (teleport) or too many strikes means "rubberband": the service moves the player back to the anchor.
// The anchor only moves forward once ANCHOR_WINDOW seconds have passed. Why not compare with the previous sample:
// the slack (a few studs) would then be granted again for every sample, and a 3x speed hack would hide inside it.
// Measured over a whole window the slack is spent once, so a sustained speed hack is caught within a second or two.
import { MAX_WALK_SPEED } from "shared/config/shoes";
import { ANCHOR_WINDOW, MAX_SPAN, MAX_STRIKES, SLACK_STUDS, SPEED_TOLERANCE, TELEPORT_STUDS } from "./tuning";

export interface MoveSample {
	readonly x: number;
	readonly y: number;
	readonly z: number;
	/** Seconds on any monotonic clock (os.clock). */
	readonly time: number;
}

/** The last honest position and how many suspicious samples came in a row. */
export interface MoveState extends MoveSample {
	readonly strikes: number;
}

export type MoveVerdict = "ok" | "strike" | "rubberband";

export interface MoveResult {
	readonly verdict: MoveVerdict;
	/** For "rubberband" this holds the position to move the player back to. */
	readonly state: MoveState;
}

function isFiniteNumber(value: number): boolean {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

function isValidSample(sample: MoveSample): boolean {
	return (
		isFiniteNumber(sample.x) && isFiniteNumber(sample.y) && isFiniteNumber(sample.z) && isFiniteNumber(sample.time)
	);
}

/** Starts tracking from a first honest position. Returns undefined if the sample is broken. */
export function beginMoveState(sample: MoveSample): MoveState | undefined {
	if (!isValidSample(sample)) {
		return undefined;
	}
	return { x: sample.x, y: sample.y, z: sample.z, time: sample.time, strikes: 0 };
}

/** Speed the check allows. A broken value falls back to the global cap, never to "unlimited". */
function allowedSpeedOf(walkSpeed: number): number {
	if (!isFiniteNumber(walkSpeed) || walkSpeed <= 0) {
		return MAX_WALK_SPEED;
	}
	return math.min(walkSpeed, MAX_WALK_SPEED);
}

/**
 * Compares a new sample with the last honest state.
 * @param walkSpeed the speed the SERVER gave this player (shoes and aura), never a client value
 */
export function checkMove(state: MoveState, sample: MoveSample, walkSpeed: number): MoveResult {
	// Broken numbers from a character mean something is badly wrong: pull the player back.
	if (!isValidSample(sample)) {
		return { verdict: "rubberband", state: { ...state, strikes: 0 } };
	}

	const span = sample.time - state.time;
	// Time did not move forward (same frame or a clock glitch): nothing to measure, keep the state.
	if (span <= 0) {
		return { verdict: "ok", state };
	}

	const dx = sample.x - state.x;
	const dz = sample.z - state.z;
	const distance = math.sqrt(dx * dx + dz * dz);
	const allowance = allowedSpeedOf(walkSpeed) * SPEED_TOLERANCE * math.min(span, MAX_SPAN) + SLACK_STUDS;

	if (distance <= allowance) {
		const strikes = math.max(0, state.strikes - 1);
		// Inside the window the anchor stays put, so the next sample is measured over a longer span.
		if (span < ANCHOR_WINDOW) {
			return { verdict: "ok", state: { ...state, strikes } };
		}
		return { verdict: "ok", state: { x: sample.x, y: sample.y, z: sample.z, time: sample.time, strikes } };
	}

	const strikes = state.strikes + 1;
	if (distance - allowance > TELEPORT_STUDS || strikes >= MAX_STRIKES) {
		// Keep the honest position, restart the clock from now so the next check measures from the pull-back.
		return { verdict: "rubberband", state: { ...state, time: sample.time, strikes: 0 } };
	}
	return { verdict: "strike", state: { ...state, strikes } };
}
