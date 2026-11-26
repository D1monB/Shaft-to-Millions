// Pure rules of the layer events (decision 065). Time and user ids are passed in, so everything is unit tested.
import {
	CAVE_IN_RADIUS,
	CLUSTER_BASE_CRYSTALS,
	CLUSTER_MIN_HITS,
	CLUSTER_SHARED_CRYSTALS,
	RAID_COOLDOWN_SECONDS,
	RAID_MAX_CRYSTALS,
	RAID_PIECES_PER_CRYSTAL,
	RAID_SECONDS,
} from "shared/config/events";
import { MAX_COUNTER } from "shared/lib/repair";
import { isFiniteNumber } from "shared/lib/validate";

/** True when a player at this horizontal distance from the circle's middle is under the falling rocks. */
export function caveInHits(distance: number, radius = CAVE_IN_RADIUS): boolean {
	return isFiniteNumber(distance) && distance >= 0 && distance <= radius;
}

// ---- crystal cluster ----

export interface ClusterState {
	/** Swings still needed. */
	left: number;
	readonly needed: number;
	/** Counted swings per user id. */
	readonly hits: Map<number, number>;
	/** When each user last hit it, for the swing cooldown. */
	readonly lastHit: Map<number, number>;
}

export function newCluster(needed: number): ClusterState {
	const safe = isFiniteNumber(needed) && needed >= 1 ? math.floor(needed) : 1;
	return { left: safe, needed: safe, hits: new Map(), lastHit: new Map() };
}

export type ClusterHit = "cooldown" | "hit" | "broken" | "gone";

/** One swing at the shared cluster. Swings faster than `swingSeconds` (x0.8 for lag) are ignored. */
export function clusterHit(state: ClusterState, userId: number, now: number, swingSeconds: number): ClusterHit {
	if (state.left <= 0) {
		return "gone";
	}
	if (!isFiniteNumber(now) || !isFiniteNumber(swingSeconds) || !(swingSeconds > 0)) {
		return "cooldown";
	}
	const last = state.lastHit.get(userId);
	if (last !== undefined && (now < last || now - last < swingSeconds * 0.8)) {
		return "cooldown";
	}
	state.lastHit.set(userId, now);
	state.hits.set(userId, (state.hits.get(userId) ?? 0) + 1);
	state.left -= 1;
	return state.left <= 0 ? "broken" : "hit";
}

/** Crystals for one user of a broken cluster: a base for anyone who helped, plus a share by their swings. */
export function clusterCrystals(state: ClusterState, userId: number): number {
	const mine = state.hits.get(userId) ?? 0;
	if (mine < CLUSTER_MIN_HITS) {
		return 0;
	}
	return CLUSTER_BASE_CRYSTALS + math.floor((CLUSTER_SHARED_CRYSTALS * mine) / state.needed);
}

// ---- timed raid ----

/** What the profile stores about raids. */
export interface RaidState {
	/** The week the best score belongs to. */
	week: number;
	best: number;
	/** Unix time the last raid started; 0 = never. */
	startedAt: number;
}

export interface RaidRun {
	readonly endsAt: number;
	score: number;
	pieces: number;
}

export function newRaidState(): RaidState {
	return { week: 0, best: 0, startedAt: 0 };
}

/** Weeks since 1970, starting on Monday (UTC). Broken input gives 0. */
export function weekOf(unixSeconds: number): number {
	if (!isFiniteNumber(unixSeconds) || unixSeconds <= 0) {
		return 0;
	}
	// 1970-01-01 was a Thursday: shifting by 3 days makes each week start on Monday.
	return math.floor((math.floor(unixSeconds / 86_400) + 3) / 7);
}

/** Seconds until a new raid may start (0 = now). A clock that went back counts as "just started". */
export function raidCooldownLeft(state: RaidState, now: number): number {
	if (state.startedAt <= 0) {
		return 0;
	}
	const waited = now - state.startedAt;
	if (!isFiniteNumber(waited) || waited < 0) {
		return RAID_COOLDOWN_SECONDS;
	}
	return math.max(0, RAID_COOLDOWN_SECONDS - waited);
}

/** Starts a raid (changes the state) or returns undefined while the cooldown runs. */
export function startRaid(state: RaidState, now: number): RaidRun | undefined {
	if (!isFiniteNumber(now) || now <= 0 || raidCooldownLeft(state, now) > 0) {
		return undefined;
	}
	state.startedAt = now;
	return { endsAt: now + RAID_SECONDS, score: 0, pieces: 0 };
}

/** Counts ore mined during a raid; after the end nothing counts. */
export function addRaidOre(run: RaidRun, price: number, pieces: number, now: number): void {
	if (now >= run.endsAt || !isFiniteNumber(price) || !isFiniteNumber(pieces) || price <= 0 || pieces <= 0) {
		return;
	}
	run.score = math.min(run.score + price * pieces, MAX_COUNTER);
	run.pieces = math.min(run.pieces + pieces, MAX_COUNTER);
}

export interface RaidResult {
	readonly score: number;
	readonly crystals: number;
	readonly newBest: boolean;
}

/** Ends a raid: updates the best score of the week the raid ended in and returns the reward. */
export function finishRaid(state: RaidState, run: RaidRun, now: number): RaidResult {
	const week = weekOf(now);
	if (state.week !== week) {
		state.week = week;
		state.best = 0;
	}
	const newBest = run.score > state.best;
	if (newBest) {
		state.best = run.score;
	}
	const crystals = math.min(RAID_MAX_CRYSTALS, math.floor(run.pieces / RAID_PIECES_PER_CRYSTAL));
	return { score: run.score, crystals, newBest };
}
