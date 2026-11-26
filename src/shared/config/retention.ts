// Numbers of the retention features (decision 070): daily calendar, rebirth, friend bonus, live events and taming.
import { BoosterId } from "./boosters";
import { ItemId } from "./items";
import { OreId } from "./ores";

// ---- 30-day calendar ----

export const CALENDAR_DAYS = 30;
/** Crystals of an ordinary day: this plus one per week passed. */
export const CALENDAR_BASE_CRYSTALS = 3;
/** Money of an ordinary day at layer 1; x CALENDAR_MONEY_GROWTH per layer deeper. */
export const CALENDAR_BASE_MONEY = 300;
export const CALENDAR_MONEY_GROWTH = 4;
/** Days that give a booster instead of money, and which one. */
export const CALENDAR_BOOSTER_DAYS: { readonly [day: number]: BoosterId | undefined } = {
	7: "ore",
	14: "money",
	21: "line",
};
export const CALENDAR_BOOSTER_SECONDS = 60 * 60;
/** The big prize of day 30: crystals and every booster for two hours. */
export const CALENDAR_FINAL_CRYSTALS = 200;
export const CALENDAR_FINAL_BOOSTER_SECONDS = 2 * 60 * 60;

// ---- rebirth ----

/** Money needed for the first rebirth; each one after costs REBIRTH_PRICE_GROWTH times more. */
export const REBIRTH_PRICE = 25_000_000;
export const REBIRTH_PRICE_GROWTH = 3;
/** Permanent money bonus per rebirth (0.5 = +50%, added). */
export const REBIRTH_MONEY_BONUS = 0.5;
export const MAX_REBIRTHS = 20;
export const REBIRTH_CRYSTALS = 100;

// ---- friends ----

/** Money bonus per friend playing on the same server ... */
export const FRIEND_BONUS = 0.1;
/** ... counted up to this many friends. */
export const MAX_FRIENDS_COUNTED = 3;

// ---- live events (by the calendar, UTC) ----

export type LiveEventId = "ore_weekend" | "crystal_week" | "gold_week";

export const ORE_WEEKEND_MULTIPLIER = 2;
export const CRYSTAL_WEEK_MULTIPLIER = 2;
export const GOLD_WEEK_MONEY = 1.25;

// ---- taming (creatures that live on the layers) ----

export interface CreatureDef {
	/** The pet this creature becomes; its model is ReplicatedStorage.PetModels/<pet>. */
	readonly pet: ItemId;
	readonly layer: number;
	/** Ore of that layer offered as food, taken from the bag on every try. */
	readonly food: OreId;
	readonly amount: number;
	/** Chance (0..1) that one offering tames it; otherwise it eats and runs away. */
	readonly chance: number;
}

export const CREATURES: ReadonlyArray<CreatureDef> = [
	{ pet: "pet_mole", layer: 1, food: "copper", amount: 30, chance: 0.5 },
	{ pet: "pet_beetle", layer: 2, food: "iron", amount: 40, chance: 0.35 },
	{ pet: "pet_moth", layer: 3, food: "silver", amount: 50, chance: 0.25 },
	{ pet: "pet_lizard", layer: 4, food: "gold", amount: 60, chance: 0.15 },
	{ pet: "pet_golem", layer: 5, food: "titanium", amount: 80, chance: 0.08 },
];

export const CREATURE_EVERY_SECONDS = 180;
export const CREATURE_LIFETIME_SECONDS = 150;
export const TAMING_DISTANCE = 14;
