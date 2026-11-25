// What the movement check does right after the SERVER moved a character. Pure, so it runs under Lune.
// Why: the client owns its character's physics, so for a few frames after a server teleport the server still sees
// the old position. Measuring from that stale spot made an honest player look like a teleporter (play-test
// 2026-11-25: a warning on every join). So the check waits until the character is near the target, and only then
// starts a new baseline there.
// The wait must not be a free pass (exploit review 2026-11-25): while waiting, a sample is only accepted near the
// target or near where the character was before the teleport (as far as it could walk since). Anything else, or a
// character that never arrives, is put at the target at once.
import { MAX_WALK_SPEED } from "shared/config/shoes";
import { SLACK_STUDS, SPEED_TOLERANCE, TELEPORT_ARRIVAL_STUDS, TELEPORT_SETTLE_SECONDS } from "./tuning";

export interface Point {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

export interface PendingTeleport {
	/** Where the character was right before the server moved it. */
	readonly from: Point;
	/** Where the server moved it. */
	readonly target: Point;
	/** Monotonic seconds (os.clock) when the teleport happened. */
	readonly started: number;
}

export type SettleVerdict = "wait" | "arrived" | "timeout";

function isFiniteNumber(value: number): boolean {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

function isFinitePoint(point: Point): boolean {
	return isFiniteNumber(point.x) && isFiniteNumber(point.y) && isFiniteNumber(point.z);
}

function distance(a: Point, b: Point): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const dz = a.z - b.z;
	return math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** A pending teleport from `from` to `target` at `now`. Undefined for broken numbers (then nothing is pending). */
export function beginSettle(from: Point, target: Point, now: number): PendingTeleport | undefined {
	if (!isFinitePoint(from) || !isFinitePoint(target) || !isFiniteNumber(now)) {
		return undefined;
	}
	return { from, target, started: now };
}

/**
 * "arrived": the character is at the target, start a new baseline from this sample.
 * "wait": still around the old position (the client has not caught up yet), skip this sample.
 * "timeout": the wait ran out, the sample is broken, or the character is somewhere it could not have walked to:
 * put it at the target.
 * @param walkSpeed the speed the SERVER gave this player
 */
export function settle(pending: PendingTeleport, sample: Point, now: number, walkSpeed: number): SettleVerdict {
	if (!isFinitePoint(sample) || !isFiniteNumber(now)) {
		return "timeout";
	}
	if (distance(sample, pending.target) <= TELEPORT_ARRIVAL_STUDS) {
		return "arrived";
	}
	const elapsed = now - pending.started;
	if (elapsed >= TELEPORT_SETTLE_SECONDS) {
		return "timeout";
	}
	const speed = isFiniteNumber(walkSpeed) && walkSpeed > 0 ? math.min(walkSpeed, MAX_WALK_SPEED) : MAX_WALK_SPEED;
	const reach = speed * SPEED_TOLERANCE * math.max(elapsed, 0) + SLACK_STUDS + TELEPORT_ARRIVAL_STUDS;
	return distance(sample, pending.from) <= reach ? "wait" : "timeout";
}
