import { t } from "@rbxts/t";
import { OreId } from "shared/config/ores";
import type { OwnedItem } from "shared/features/chests";
import type { DrillState } from "shared/features/drill";
import type { Equipped } from "shared/features/equipment";
import { LineState, newLineState } from "shared/features/line";
import { QuestState, newQuestState } from "shared/features/quests";
import { BoostState, newBoostState } from "shared/features/boosters";
import { GearState, createStarterGear } from "shared/features/upgrades";

/**
 * Bump this ONLY for changes that old saves cannot survive on their own
 * (renaming, removing, re-interpreting a field). Every bump needs a migration and a test.
 * Adding a new field with a default does NOT need a bump: loadProfileData fills it in.
 * Also bump (with an empty migration) when you RAISE a cap in sanitize.ts, otherwise an older server
 * still running during an update clamps the new value and saves it over the player's data.
 */
export const CURRENT_SCHEMA_VERSION = 7;

/** Lifetime counters. Used for the hint system and later for leaderboards. */
export interface ProfileStats {
	totalEarned: number;
	oresMined: number;
}

/**
 * What we save per player. Derived values (bag capacity, walk speed, sell multiplier) are NOT stored:
 * they are calculated from gear, levels and equipment, so changing a formula never breaks old saves.
 * Each feature adds its own fields here together with a default and a sanitize rule.
 */
export interface ProfileData {
	schemaVersion: number;
	money: number;
	/** Crystals, the second currency (decision 043): rare drop from ore, spent on chests and boosters. Also sold for Robux since decision 057 (not to restricted players). */
	crystals: number;
	stats: ProfileStats;
	/** Ore the player carries. Missing id = 0. */
	bag: Partial<Record<OreId, number>>;
	/** Shop gear: owned item ids and the equipped one per slot (see config/pickaxes.ts, bags.ts, shoes.ts). */
	gear: GearState;
	/** The tycoon production line on the player's plot (decisions 027): bought machines, levels and queues. */
	line: LineState;
	/** Unix time the profile was last active, for the offline run of the line. 0 = never. */
	lastSeen: number;
	/** Deepest layer whose camp the player reached. Drives drill unlocks and the depth leaderboard later. */
	deepestLayer: number;
	/** Deepest point the player stood on, in game meters below the surface. Breaks ties on the depth board. */
	deepestMeters: number;
	/** Owned auto drills by drillKey(layer). */
	drills: { [key: string]: DrillState | undefined };
	/** Items from chests (pets, auras). */
	inventory: OwnedItem[];
	/** Next item uid number. Only grows, so a uid is never reused. */
	nextUid: number;
	/** Granted Robux receipts (PurchaseId). Private: never sent to the client. */
	purchaseIds: string[];
	/** The language chosen in the game menu (decision 033), "" = automatic (Roblox language, then country). */
	language: string;
	/** False after the player switched the game's sounds off in the menu (decision 053). */
	soundOn: boolean;
	/** Daily quests, the story chain and the login streak (decision 055). */
	quests: QuestState;
	/** Unix end time of each booster (decision 057); 0 = off. */
	boosts: BoostState;
	/** Equipped item uids (from `inventory`). */
	equipped: Equipped;
}

export function createDefaultProfileData(): ProfileData {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		money: 0,
		crystals: 0,
		stats: { totalEarned: 0, oresMined: 0 },
		bag: {},
		gear: createStarterGear(),
		deepestLayer: 1,
		deepestMeters: 0,
		drills: {},
		inventory: [],
		nextUid: 1,
		purchaseIds: [],
		equipped: { pets: [] },
		line: newLineState(),
		lastSeen: 0,
		language: "",
		soundOn: true,
		quests: newQuestState(),
		boosts: newBoostState(),
	};
}

// Structure check only. Value ranges are enforced by sanitize.ts before this runs.
// `interface` (not strictInterface) allows extra keys, so data from a newer feature is not rejected.
// Id-keyed maps (bag, drills) are only checked to be tables: sanitize.ts repairs every KNOWN
// key, and an unknown key from a newer server must never make the whole save unloadable.
const profileDataShape = t.interface({
	schemaVersion: t.integer,
	money: t.integer,
	crystals: t.integer,
	stats: t.interface({ totalEarned: t.integer, oresMined: t.integer }),
	bag: t.table,
	gear: t.interface({
		owned: t.array(t.string),
		equipped: t.interface({ pickaxe: t.string, bag: t.string, shoes: t.string }),
	}),
	deepestLayer: t.integer,
	deepestMeters: t.integer,
	drills: t.table,
	line: t.interface({
		intake: t.array(t.string),
		beltProgress: t.number,
		beltLevel: t.integer,
		machines: t.array(
			t.interface({
				speed: t.integer,
				duplicate: t.integer,
				quality: t.integer,
				capacity: t.integer,
				progress: t.number,
				queue: t.array(t.string),
			}),
		),
	}),
	lastSeen: t.number,
	language: t.string,
	soundOn: t.boolean,
	boosts: t.interface({ money: t.number, ore: t.number, line: t.number }),
	quests: t.interface({
		day: t.integer,
		daily: t.array(t.interface({ id: t.string, count: t.number, claimed: t.boolean })),
		allDoneClaimed: t.boolean,
		chain: t.integer,
		chainCount: t.number,
		streak: t.integer,
		loginDay: t.integer,
		streakClaimedDay: t.integer,
	}),
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
