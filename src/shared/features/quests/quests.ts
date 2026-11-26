// Pure quest rules (decision 055). No Roblox API: the server passes in the day number, the random roll and a snapshot
// of the profile, so every rule is unit tested.
import {
	CHAIN_QUESTS,
	DAILY_ALL_DONE_REWARD,
	DAILY_COUNT,
	DAILY_MONEY_GROWTH,
	DAILY_QUESTS,
	DAILY_TARGET_GROWTH,
	QuestDef,
	QuestEventKind,
	QuestReward,
	STREAK_REWARDS,
} from "shared/config/quests";
import { isFiniteNumber } from "shared/lib/validate";

export interface DailyEntry {
	/** Id from DAILY_QUESTS. */
	id: string;
	/** Events counted so far today. */
	count: number;
	claimed: boolean;
}

/** What the profile stores. */
export interface QuestState {
	/** The day (whole days since 1970, UTC) the daily list belongs to. 0 = never rolled. */
	day: number;
	daily: DailyEntry[];
	/** True once today's "all done" bonus was claimed. */
	allDoneClaimed: boolean;
	/** Index into CHAIN_QUESTS of the active story quest (= quests already claimed). */
	chain: number;
	/** Events counted for the active story quest since it became active. */
	chainCount: number;
	/** Days in a row the player came back (1..). */
	streak: number;
	/** The day the streak was last counted. */
	loginDay: number;
	/** The day the streak reward was last claimed. */
	streakClaimedDay: number;
}

/** Profile values the state kinds read. Passed in so this file never touches the profile type. */
export interface QuestSnapshot {
	readonly machines: number;
	readonly deepestLayer: number;
	readonly ownedGear: ReadonlyArray<string>;
	readonly beltLevel: number;
	readonly drills: number;
}

export function newQuestState(): QuestState {
	return {
		day: 0,
		daily: [],
		allDoneClaimed: false,
		chain: 0,
		chainCount: 0,
		streak: 0,
		loginDay: 0,
		streakClaimedDay: 0,
	};
}

/** Whole days since 1970 (UTC) for a unix time; broken input gives 0. */
export function dayOf(unixSeconds: number): number {
	return isFiniteNumber(unixSeconds) && unixSeconds > 0 ? math.floor(unixSeconds / 86_400) : 0;
}

function safeLayer(layer: number): number {
	return isFiniteNumber(layer) ? math.clamp(math.floor(layer), 1, 20) : 1;
}

export function findDaily(id: string): QuestDef | undefined {
	return DAILY_QUESTS.find((def) => def.id === id);
}

/** A daily quest as this player sees it: target and money grow with their deepest layer, crystals stay. */
export function scaledDaily(def: QuestDef, deepestLayer: number): QuestDef {
	const steps = safeLayer(deepestLayer) - 1;
	const target = math.max(1, math.floor(def.target * math.pow(DAILY_TARGET_GROWTH, steps)));
	const money =
		def.reward.money !== undefined ? math.floor(def.reward.money * math.pow(DAILY_MONEY_GROWTH, steps)) : undefined;
	return { ...def, target, reward: { ...def.reward, money } };
}

/**
 * Picks `DAILY_COUNT` different daily quests. `roll` gives numbers in [0, 1); a broken roll still returns distinct
 * quests (it falls back to the first ones of the pool).
 */
export function pickDaily(roll: () => number): DailyEntry[] {
	const pool = DAILY_QUESTS.map((def) => def.id);
	const picked: DailyEntry[] = [];
	while (picked.size() < DAILY_COUNT && pool.size() > 0) {
		const value = roll();
		const unit = value === value ? math.clamp(value, 0, 0.999999) : 0;
		const id = pool.remove(math.floor(unit * pool.size())) as string;
		picked.push({ id, count: 0, claimed: false });
	}
	return picked;
}

/**
 * Called when the player joins and on every tick: on a new day, rolls new daily quests and counts the login streak.
 * Returns true when something changed (the caller saves). A clock going backwards changes nothing.
 */
export function rollOver(state: QuestState, today: number, roll: () => number): boolean {
	if (!(today > 0) || today <= state.day) {
		return false;
	}
	state.day = today;
	state.daily = pickDaily(roll);
	state.allDoneClaimed = false;
	if (today > state.loginDay) {
		// One missed day breaks the streak; day 7 is followed by a new week.
		state.streak = today === state.loginDay + 1 ? state.streak + 1 : 1;
		state.loginDay = today;
	}
	return true;
}

/** Counts an event (e.g. 3 pieces of copper mined) for today's quests and the active story quest. */
export function recordEvent(state: QuestState, kind: QuestEventKind, amount: number, ore?: string): boolean {
	if (!isFiniteNumber(amount) || amount <= 0) {
		return false;
	}
	let changed = false;
	for (const entry of state.daily) {
		const def = findDaily(entry.id);
		if (def !== undefined && !entry.claimed && matches(def, kind, ore)) {
			entry.count = math.min(entry.count + amount, 1e12);
			changed = true;
		}
	}
	const active = CHAIN_QUESTS[state.chain];
	if (active !== undefined && matches(active, kind, ore)) {
		state.chainCount = math.min(state.chainCount + amount, 1e12);
		changed = true;
	}
	return changed;
}

function matches(def: QuestDef, kind: QuestEventKind, ore?: string): boolean {
	return def.kind === kind && (def.ore === undefined || def.ore === ore);
}

/** Progress of a quest: events counted for event kinds, the profile value for state kinds. */
export function questProgress(def: QuestDef, counted: number, snapshot: QuestSnapshot): number {
	switch (def.kind) {
		case "machines":
			return snapshot.machines;
		case "layer":
			return snapshot.deepestLayer;
		case "gear":
			return def.gear !== undefined && snapshot.ownedGear.includes(def.gear) ? 1 : 0;
		case "belt":
			return snapshot.beltLevel;
		case "drills":
			return snapshot.drills;
		default:
			return isFiniteNumber(counted) ? counted : 0;
	}
}

export function isDone(def: QuestDef, counted: number, snapshot: QuestSnapshot): boolean {
	return questProgress(def, counted, snapshot) >= def.target;
}

export type ClaimResult =
	| { readonly ok: true; readonly reward: QuestReward }
	| { readonly ok: false; readonly reason: "unknown" | "not-done" | "claimed" };

/** Claims daily quest number `index` (0-based). Changes the state only on success; the caller pays the reward. */
export function claimDaily(
	state: QuestState,
	index: unknown,
	snapshot: QuestSnapshot,
	deepestLayer: number,
): ClaimResult {
	if (!isFiniteNumber(index) || index !== math.floor(index)) {
		return { ok: false, reason: "unknown" };
	}
	const entry = state.daily[index];
	const def = entry !== undefined ? findDaily(entry.id) : undefined;
	if (entry === undefined || def === undefined) {
		return { ok: false, reason: "unknown" };
	}
	if (entry.claimed) {
		return { ok: false, reason: "claimed" };
	}
	const scaled = scaledDaily(def, deepestLayer);
	if (!isDone(scaled, entry.count, snapshot)) {
		return { ok: false, reason: "not-done" };
	}
	entry.claimed = true;
	return { ok: true, reward: scaled.reward };
}

/** The bonus for claiming every daily quest of the day. */
export function claimAllDone(state: QuestState): ClaimResult {
	if (state.allDoneClaimed) {
		return { ok: false, reason: "claimed" };
	}
	if (state.daily.size() === 0 || !state.daily.every((entry) => entry.claimed)) {
		return { ok: false, reason: "not-done" };
	}
	state.allDoneClaimed = true;
	return { ok: true, reward: DAILY_ALL_DONE_REWARD };
}

/** Claims the active story quest and opens the next one. */
export function claimChain(state: QuestState, snapshot: QuestSnapshot): ClaimResult {
	const active = CHAIN_QUESTS[state.chain];
	if (active === undefined) {
		return { ok: false, reason: "unknown" };
	}
	if (!isDone(active, state.chainCount, snapshot)) {
		return { ok: false, reason: "not-done" };
	}
	state.chain += 1;
	state.chainCount = 0;
	return { ok: true, reward: active.reward };
}

/** The reward of the current streak day (1..7, then the week repeats). */
export function streakReward(streak: number): QuestReward {
	const day = isFiniteNumber(streak) && streak >= 1 ? (math.floor(streak) - 1) % STREAK_REWARDS.size() : 0;
	return STREAK_REWARDS[day];
}

/** Claims today's streak reward, once per day. */
export function claimStreak(state: QuestState, today: number): ClaimResult {
	if (!(today > 0) || state.loginDay !== today || state.streak < 1) {
		return { ok: false, reason: "not-done" };
	}
	if (state.streakClaimedDay === today) {
		return { ok: false, reason: "claimed" };
	}
	state.streakClaimedDay = today;
	return { ok: true, reward: streakReward(state.streak) };
}
