// Depth progress. A layer opens when the player reaches its camp, and only one step at a time:
// a player who teleports (exploit) straight to layer 3 does not skip layer 2.
import { LAYER_COUNT } from "shared/config/layers";

/** The new deepest layer after reaching the camp of `layer`, or undefined if nothing changes. */
export function reachLayer(deepestLayer: number, layer: number): number | undefined {
	if (layer !== layer || math.floor(layer) !== layer || layer < 1 || layer > LAYER_COUNT) {
		return undefined;
	}
	if (layer === deepestLayer + 1) {
		return layer;
	}
	return undefined;
}

/**
 * Minimum seconds between two layer unlocks (and after joining). A real descent takes minutes, so honest players
 * never notice; a teleport exploit can no longer open every layer within seconds.
 * A full server-side movement check is still planned (see docs/roadmap.md).
 */
export const MIN_SECONDS_BETWEEN_UNLOCKS = 45;

/** Seconds until the next layer may be unlocked. 0 = allowed now. A clock going backwards counts as "just unlocked". */
export function unlockCooldownLeft(now: number, lastUnlockAt: number): number {
	const elapsed = now - lastUnlockAt;
	if (elapsed !== elapsed || elapsed < 0) {
		return MIN_SECONDS_BETWEEN_UNLOCKS;
	}
	return math.max(0, MIN_SECONDS_BETWEEN_UNLOCKS - elapsed);
}

/** Ore may only be mined on layers the player has opened. Stops mining deep ore after teleporting down. */
export function isLayerOpen(oreLayer: number, deepestLayer: number): boolean {
	return oreLayer >= 1 && oreLayer <= deepestLayer;
}
