// What the movement check does right after the SERVER moved a character. Pure, so it runs under Lune.
// Why: the client owns its character's physics, so for a few frames after a server teleport the server still sees
// the old position. Measuring from that stale spot made an honest player look like a teleporter (play-test
// 2026-11-25: a warning on every join). So the check waits until the character is near the target, and only then
// starts a new baseline there. A character that never arrives is put at the target when the wait runs out, so the
// wait cannot be used to move freely.
import { TELEPORT_ARRIVAL_STUDS, TELEPORT_SETTLE_SECONDS } from "./tuning";

export interface PendingTeleport {
	readonly x: number;
	readonly y: number;
	readonly z: number;
	/** Monotonic seconds (os.clock) when the wait ends. */
	readonly until: number;
}

export type SettleVerdict = "wait" | "arrived" | "timeout";

function isFiniteNumber(value: number): boolean {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

/** A pending teleport to (x, y, z) that started at `now`. Undefined for broken numbers (then nothing is pending). */
export function beginSettle(x: number, y: number, z: number, now: number): PendingTeleport | undefined {
	if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z) || !isFiniteNumber(now)) {
		return undefined;
	}
	return { x, y, z, until: now + TELEPORT_SETTLE_SECONDS };
}

/**
 * "arrived": the character is at the target, start a new baseline from this sample.
 * "wait": still the old position, skip this sample.
 * "timeout": the wait ran out (or the sample is broken), put the character at the target.
 */
export function settle(pending: PendingTeleport, x: number, y: number, z: number, now: number): SettleVerdict {
	if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z) || !isFiniteNumber(now)) {
		return "timeout";
	}
	const dx = x - pending.x;
	const dy = y - pending.y;
	const dz = z - pending.z;
	if (math.sqrt(dx * dx + dy * dy + dz * dz) <= TELEPORT_ARRIVAL_STUDS) {
		return "arrived";
	}
	return now < pending.until ? "wait" : "timeout";
}
