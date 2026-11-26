// Pure booster rules (decision 057). The server passes in the unix time, so everything is unit tested.
import { BOOSTERS, BOOSTER_IDS, BOOST_MAX_SECONDS, BoosterId } from "shared/config/boosters";
import { isFiniteNumber } from "shared/lib/validate";

/** Unix time each booster ends at; 0 or missing = not active. */
export type BoostState = { [K in BoosterId]: number };

export function newBoostState(): BoostState {
	return { money: 0, ore: 0, line: 0 };
}

/** Seconds left of a booster; 0 when off. A broken end time counts as off. */
export function boostSecondsLeft(state: BoostState, id: BoosterId, now: number): number {
	const endsAt = state[id];
	if (!isFiniteNumber(endsAt) || !isFiniteNumber(now)) {
		return 0;
	}
	return math.clamp(endsAt - now, 0, BOOST_MAX_SECONDS);
}

/** What the booster multiplies by right now: its multiplier while active, else 1. */
export function boostMultiplier(state: BoostState, id: BoosterId, now: number): number {
	return boostSecondsLeft(state, id, now) > 0 ? BOOSTERS[id].multiplier : 1;
}

/**
 * Adds `seconds` to a booster: from now if it is off, from its end if it is on, never further than BOOST_MAX_SECONDS
 * from now. Returns the seconds actually added (0 for bad input or a full booster), so the caller can refuse to
 * charge for nothing.
 */
export function addBoost(state: BoostState, id: BoosterId, seconds: number, now: number): number {
	if (!isFiniteNumber(seconds) || seconds <= 0 || !isFiniteNumber(now) || now <= 0) {
		return 0;
	}
	const start = now + boostSecondsLeft(state, id, now);
	const endsAt = math.min(start + seconds, now + BOOST_MAX_SECONDS);
	const added = endsAt - start;
	if (added <= 0) {
		return 0;
	}
	state[id] = endsAt;
	return added;
}

/** Ids of the boosters running now, in display order. */
export function activeBoosters(state: BoostState, now: number): BoosterId[] {
	return BOOSTER_IDS.filter((id) => boostSecondsLeft(state, id, now) > 0);
}
