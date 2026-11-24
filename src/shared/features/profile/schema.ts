import { t } from "@rbxts/t";
import { MachineId } from "shared/config/machines";
import { OreId } from "shared/config/ores";
import type { OwnedItem } from "shared/features/chests";
import type { DrillState } from "shared/features/drill";
import type { Equipped } from "shared/features/equipment";
import type { Counts, MachineState } from "shared/features/factory";

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
	/** Ore the player carries. Missing id = 0. */
	bag: Partial<Record<OreId, number>>;
	/** Gear levels, 1-based (level 1 = starter gear). */
	levels: GearLevels;
	/** Base storage on the surface (ore and products). */
	warehouse: Counts;
	/** Owned machines. A machine is owned when its entry exists. */
	machines: Partial<Record<MachineId, MachineState>>;
	/** Deepest layer whose camp the player reached. Drives drill unlocks and the depth leaderboard later. */
	deepestLayer: number;
	/** Owned auto drills by drillKey(layer). */
	drills: { [key: string]: DrillState | undefined };
	/** Items from chests (pets, auras). */
	inventory: OwnedItem[];
	/** Next item uid number. Only grows, so a uid is never reused. */
	nextUid: number;
	/** Granted Robux receipts (PurchaseId). Private: never sent to the client. */
	purchaseIds: string[];
	/** Equipped item uids (from `inventory`). */
	equipped: Equipped;
}

export interface GearLevels {
	pickaxe: number;
	bag: number;
	shoes: number;
}

export function createDefaultProfileData(): ProfileData {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		money: 0,
		stats: { totalEarned: 0, oresMined: 0 },
		bag: {},
		levels: { pickaxe: 1, bag: 1, shoes: 1 },
		deepestLayer: 1,
		drills: {},
		inventory: [],
		nextUid: 1,
		purchaseIds: [],
		equipped: { pets: [] },
		warehouse: {},
		machines: {},
	};
}

// Structure check only. Value ranges are enforced by sanitize.ts before this runs.
// `interface` (not strictInterface) allows extra keys, so data from a newer feature is not rejected.
// Id-keyed maps (bag, warehouse, drills, machines) are only checked to be tables: sanitize.ts repairs every KNOWN
// key, and an unknown key from a newer server must never make the whole save unloadable.
const profileDataShape = t.interface({
	schemaVersion: t.integer,
	money: t.integer,
	stats: t.interface({ totalEarned: t.integer, oresMined: t.integer }),
	bag: t.table,
	levels: t.interface({ pickaxe: t.integer, bag: t.integer, shoes: t.integer }),
	deepestLayer: t.integer,
	drills: t.table,
	warehouse: t.table,
	machines: t.table,
	inventory: t.array(t.interface({ uid: t.string, item: t.string })),
	nextUid: t.integer,
	purchaseIds: t.array(t.string),
	equipped: t.interface({
		speedAura: t.optional(t.string),
		pickaxeAura: t.optional(t.string),
		pets: t.array(t.string),
	}),
});

export function isProfileData(value: unknown): value is ProfileData {
	return profileDataShape(value);
}
