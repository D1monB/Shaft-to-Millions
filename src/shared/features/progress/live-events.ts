// Seasonal live events by the UTC calendar (decision 070): no update or restart is needed for them to come and go.
// Weekends double ore; on weekdays every third week brings more crystals, the next one more money.
import { CRYSTAL_WEEK_MULTIPLIER, GOLD_WEEK_MONEY, LiveEventId, ORE_WEEKEND_MULTIPLIER } from "shared/config/retention";
import { weekOf } from "shared/features/events";
import { isFiniteNumber } from "shared/lib/validate";

export function liveEventAt(unixSeconds: number): LiveEventId | undefined {
	if (!isFiniteNumber(unixSeconds) || unixSeconds <= 0) {
		return undefined;
	}
	// 1970-01-01 was a Thursday: 0 = Sunday after adding 4.
	const weekday = (math.floor(unixSeconds / 86_400) + 4) % 7;
	if (weekday === 0 || weekday === 6) {
		return "ore_weekend";
	}
	const turn = weekOf(unixSeconds) % 3;
	if (turn === 0) {
		return "crystal_week";
	}
	return turn === 1 ? "gold_week" : undefined;
}

export interface LiveBonuses {
	readonly ore: number;
	readonly crystals: number;
	readonly money: number;
}

export function liveBonuses(event: LiveEventId | undefined): LiveBonuses {
	return {
		ore: event === "ore_weekend" ? ORE_WEEKEND_MULTIPLIER : 1,
		crystals: event === "crystal_week" ? CRYSTAL_WEEK_MULTIPLIER : 1,
		money: event === "gold_week" ? GOLD_WEEK_MONEY : 1,
	};
}
