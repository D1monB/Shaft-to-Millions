// Pure rules of the leaderboards: depth in meters, the stored scores and the rows read back from the store.
// The server writes only values it computed itself from the profile, never anything the client sent.
import { LAYER_COUNT, MAX_DEPTH_METERS } from "shared/config/layers";
import { MAX_COUNTER } from "shared/lib/repair";
import { DEPTH_LAYER_FACTOR, LEADERBOARD_SIZE, METERS_PER_STUD } from "./tuning";

export type BoardId = "depth" | "wealth";

export const BOARD_IDS: ReadonlyArray<BoardId> = ["depth", "wealth"];

function isFiniteNumber(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

/** Whole meters below the surface for a position height. Above the surface or broken input = 0. */
export function depthMeters(surfaceY: number, y: number): number {
	if (!isFiniteNumber(surfaceY) || !isFiniteNumber(y)) {
		return 0;
	}
	const meters = math.floor((surfaceY - y) * METERS_PER_STUD);
	return math.clamp(meters, 0, MAX_DEPTH_METERS);
}

/**
 * The new deepest depth after a sample, or undefined if the record does not change.
 * `cap` is the deepest depth the player may have reached (the camp of the first locked layer), so walking
 * or falling past a locked camp never becomes a record.
 */
export function recordDepth(current: number, sample: number, cap: number): number | undefined {
	if (!isFiniteNumber(sample) || !isFiniteNumber(current)) {
		return undefined;
	}
	const limit = isFiniteNumber(cap) ? math.min(cap, MAX_DEPTH_METERS) : MAX_DEPTH_METERS;
	const value = math.floor(math.min(sample, limit));
	return value > current ? value : undefined;
}

/** The depth board score: the layer decides first, meters break ties. Broken input is repaired, never thrown. */
export function depthScore(layer: number, meters: number): number {
	const safeLayer = isFiniteNumber(layer) ? math.clamp(math.floor(layer), 1, LAYER_COUNT) : 1;
	const safeMeters = isFiniteNumber(meters) ? math.clamp(math.floor(meters), 0, MAX_DEPTH_METERS) : 0;
	return safeLayer * DEPTH_LAYER_FACTOR + safeMeters;
}

export interface DepthRecord {
	readonly layer: number;
	readonly meters: number;
}

/** Reverses depthScore for display. */
export function decodeDepthScore(score: number): DepthRecord {
	const safe = isFiniteNumber(score) && score > 0 ? math.floor(score) : 0;
	return { layer: math.floor(safe / DEPTH_LAYER_FACTOR), meters: safe % DEPTH_LAYER_FACTOR };
}

/** The wealth board score: lifetime earnings, so buying things never drops a player down the board. */
export function wealthScore(totalEarned: number): number {
	return isFiniteNumber(totalEarned) ? math.clamp(math.floor(totalEarned), 0, MAX_COUNTER) : 0;
}

/** A store write is only worth its budget when the score grew. Scores never go down. */
export function shouldWrite(lastWritten: number | undefined, score: number): boolean {
	if (!isFiniteNumber(score) || score <= 0) {
		return false;
	}
	return lastWritten === undefined || score > lastWritten;
}

/** Keeps the higher of the stored and the new score: the store's update callback, safe across servers. */
export function higherScore(stored: unknown, score: number): number {
	const old = isFiniteNumber(stored) && stored > 0 ? math.floor(stored) : 0;
	return math.max(old, score);
}

export interface BoardRow {
	readonly userId: number;
	readonly score: number;
}

/**
 * Turns raw rows from the store into clean, sorted top rows. Anything malformed (bad key, bad value,
 * duplicate user) is dropped, so a corrupted entry can never break the board for everyone.
 */
export function cleanRows(raw: unknown): BoardRow[] {
	if (!typeIs(raw, "table")) {
		return [];
	}
	const seen = new Set<number>();
	const rows: BoardRow[] = [];
	for (const entry of raw as unknown[]) {
		if (!typeIs(entry, "table")) {
			continue;
		}
		const { key, value } = entry as { key?: unknown; value?: unknown };
		const userId = typeIs(key, "string") ? tonumber(key) : undefined;
		if (userId === undefined || !isFiniteNumber(userId) || userId <= 0 || math.floor(userId) !== userId) {
			continue;
		}
		if (!isFiniteNumber(value) || value <= 0 || seen.has(userId)) {
			continue;
		}
		seen.add(userId);
		rows.push({ userId, score: math.floor(value) });
	}
	rows.sort((a, b) => a.score > b.score || (a.score === b.score && a.userId < b.userId));
	const top: BoardRow[] = [];
	for (const row of rows) {
		if (top.size() >= LEADERBOARD_SIZE) {
			break;
		}
		top.push(row);
	}
	return top;
}
