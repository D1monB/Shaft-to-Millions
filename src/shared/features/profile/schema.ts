import { t } from "@rbxts/t";

/**
 * Bump this ONLY for changes that old saves cannot survive on their own
 * (renaming, removing, re-interpreting a field). Every bump needs a migration and a test.
 * Adding a new field with a default does NOT need a bump: loadProfileData fills it in.
 * Also bump (with an empty migration) when you RAISE a cap in sanitize.ts, otherwise an older server
 * still running during an update clamps the new value and saves it over the player's data.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/** Lifetime counters. Used for the hint system and later for leaderboards. */
export interface ProfileStats {
	totalEarned: number;
	oresMined: number;
}

/**
 * What we save per player. Derived values (bag capacity, walk speed, sell multiplier) are NOT stored:
 * they are calculated from levels and equipment, so changing a formula never breaks old saves.
 * Each feature adds its own fields here together with a default and a sanitize rule.
 */
export interface ProfileData {
	schemaVersion: number;
	money: number;
	stats: ProfileStats;
}

export function createDefaultProfileData(): ProfileData {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		money: 0,
		stats: { totalEarned: 0, oresMined: 0 },
	};
}

// Structure check only. Value ranges are enforced by sanitize.ts before this runs.
// `interface` (not strictInterface) allows extra keys, so data from a newer feature is not rejected.
const profileDataShape = t.interface({
	schemaVersion: t.integer,
	money: t.integer,
	stats: t.interface({ totalEarned: t.integer, oresMined: t.integer }),
});

export function isProfileData(value: unknown): value is ProfileData {
	return profileDataShape(value);
}
