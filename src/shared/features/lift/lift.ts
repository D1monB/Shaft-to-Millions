// Lift rules (decision 040). Pure: no Roblox calls, unit tested.
import { isLayerOpen } from "shared/features/layers";
import { LIFT_SPEED, MAX_RIDE_SECONDS, MIN_RIDE_SECONDS } from "./tuning";

function finite(value: number): boolean {
	return value === value && value > -math.huge && value < math.huge;
}

/** How long a ride of `distance` studs takes. */
export function rideSeconds(distance: number): number {
	if (!finite(distance) || distance <= 0) {
		return MIN_RIDE_SECONDS;
	}
	return math.clamp(distance / LIFT_SPEED, MIN_RIDE_SECONDS, MAX_RIDE_SECONDS);
}

/** How far along the ride is, 0..1, easing in and out so the cage starts and stops softly. */
export function rideProgress(elapsed: number, duration: number): number {
	if (!finite(duration) || duration <= 0 || !finite(elapsed)) {
		return 1;
	}
	const x = math.clamp(elapsed / duration, 0, 1);
	return x * x * (3 - 2 * x);
}

/**
 * Going down may only end on an opened layer: otherwise the lift would skip the descent. Going up is always allowed,
 * so climbing out of the mine is never a punishment. A bottom stop without a layer counts as layer 1 (always open).
 */
export function mayRide(goingDown: boolean, bottomLayer: number | undefined, deepestLayer: number): boolean {
	if (!goingDown) {
		return true;
	}
	const layer = bottomLayer !== undefined && finite(bottomLayer) ? math.floor(bottomLayer) : 1;
	return isLayerOpen(layer, deepestLayer);
}
