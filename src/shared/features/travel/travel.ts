// Fast travel rules. Pure: the server uses them to decide, the client uses the same ones to build the list,
// so the panel never offers a trip the server would refuse.
import { LAYER_COUNT } from "shared/config/layers";
import { isIntegerInRange } from "shared/lib/validate";
import { TRAVEL_COOLDOWN } from "./tuning";

/** Destination number of the player's own plot (the base). Always allowed. */
export const HOME = -1;

/** Destination number of the surface. Camps use their layer number (1..LAYER_COUNT). */
export const SURFACE = 0;

/** True for a whole number from HOME to LAYER_COUNT. Anything else from a client is dropped. */
export function isTravelDestination(value: unknown): value is number {
	return isIntegerInRange(value, HOME, LAYER_COUNT);
}

/** How deep the player has really been, as a safe whole number (a broken save value counts as 0). */
function safeDeepest(deepestLayer: number): number {
	if (!typeIs(deepestLayer, "number") || deepestLayer !== deepestLayer) {
		return 0;
	}
	return math.clamp(math.floor(deepestLayer), 0, LAYER_COUNT);
}

/** The surface is always allowed; a camp only after the player has opened that layer. */
export function canTravelTo(destination: number, deepestLayer: number): boolean {
	return isTravelDestination(destination) && destination <= safeDeepest(deepestLayer);
}

/** Every place the player may travel to: the base, the surface, then opened camps from the top down. */
export function travelDestinations(deepestLayer: number): number[] {
	const result: number[] = [HOME];
	for (let destination = SURFACE; destination <= safeDeepest(deepestLayer); destination++) {
		result.push(destination);
	}
	return result;
}

/**
 * Seconds left before the next travel. `lastTravelAt` is undefined before the first trip.
 * A clock that went backwards or a broken number gives the full pause, never a free trip.
 */
export function travelCooldownLeft(now: number, lastTravelAt: number | undefined): number {
	if (lastTravelAt === undefined) {
		return 0;
	}
	if (now !== now || lastTravelAt !== lastTravelAt || now < lastTravelAt) {
		return TRAVEL_COOLDOWN;
	}
	return math.clamp(TRAVEL_COOLDOWN - (now - lastTravelAt), 0, TRAVEL_COOLDOWN);
}
