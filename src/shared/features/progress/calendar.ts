// The 30-day login calendar (decision 070). Unlike the weekly streak it never resets after a missed day: every day the
// player claims moves one square forward. After day 30 a new month starts.
import {
	CALENDAR_BASE_CRYSTALS,
	CALENDAR_BASE_MONEY,
	CALENDAR_BOOSTER_DAYS,
	CALENDAR_BOOSTER_SECONDS,
	CALENDAR_DAYS,
	CALENDAR_FINAL_BOOSTER_SECONDS,
	CALENDAR_FINAL_CRYSTALS,
	CALENDAR_MONEY_GROWTH,
} from "shared/config/retention";
import { BOOSTER_IDS, BoosterId } from "shared/config/boosters";
import { isFiniteNumber } from "shared/lib/validate";

export interface CalendarState {
	/** Squares claimed in the current month, 0..29. */
	claimed: number;
	/** The day (whole days since 1970) of the last claim; 0 = never. */
	lastDay: number;
}

export function newCalendarState(): CalendarState {
	return { claimed: 0, lastDay: 0 };
}

export interface DayReward {
	readonly money: number;
	readonly crystals: number;
	readonly boosters: ReadonlyArray<BoosterId>;
	readonly boosterSeconds: number;
}

/** The reward of square `day` (1..30) for a player whose deepest layer is `layer`. */
export function calendarReward(day: number, layer: number): DayReward {
	const safeDay = isFiniteNumber(day) ? math.clamp(math.floor(day), 1, CALENDAR_DAYS) : 1;
	const depth = isFiniteNumber(layer) ? math.clamp(math.floor(layer), 1, 10) : 1;
	if (safeDay === CALENDAR_DAYS) {
		return {
			money: 0,
			crystals: CALENDAR_FINAL_CRYSTALS,
			boosters: BOOSTER_IDS,
			boosterSeconds: CALENDAR_FINAL_BOOSTER_SECONDS,
		};
	}
	const booster = CALENDAR_BOOSTER_DAYS[safeDay];
	return {
		money: booster !== undefined ? 0 : CALENDAR_BASE_MONEY * math.pow(CALENDAR_MONEY_GROWTH, depth - 1),
		crystals: CALENDAR_BASE_CRYSTALS + math.floor((safeDay - 1) / 7),
		boosters: booster !== undefined ? [booster] : [],
		boosterSeconds: booster !== undefined ? CALENDAR_BOOSTER_SECONDS : 0,
	};
}

export function canClaimCalendar(state: CalendarState, today: number): boolean {
	return today > 0 && today > state.lastDay;
}

/** Claims today's square and returns its number (1..30), or undefined if already claimed today. */
export function claimCalendarDay(state: CalendarState, today: number): number | undefined {
	if (!canClaimCalendar(state, today)) {
		return undefined;
	}
	state.lastDay = today;
	const day = math.clamp(state.claimed, 0, CALENDAR_DAYS - 1) + 1;
	state.claimed = day >= CALENDAR_DAYS ? 0 : day;
	return day;
}
