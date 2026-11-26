// The aura roll machine (decision 064): spin for a speed or pickaxe aura. Free spins come back over time (also while
// away), more spins cost crystals. Crystals are sold for Robux, so the odds are always shown (see config/chests.ts).
import { ItemId } from "./items";

export interface RollEntry {
	readonly item: ItemId;
	readonly weight: number;
}

export const AURA_ROLL_TABLE: ReadonlyArray<RollEntry> = [
	{ item: "aura_breeze", weight: 230 },
	{ item: "paura_glint", weight: 230 },
	{ item: "aura_spark", weight: 150 },
	{ item: "paura_ember", weight: 150 },
	{ item: "aura_comet", weight: 80 },
	{ item: "paura_quake", weight: 80 },
	{ item: "aura_lightning", weight: 30 },
	{ item: "paura_prism", weight: 30 },
	{ item: "aura_storm", weight: 10 },
	{ item: "paura_core", weight: 10 },
];

/** A free spin comes back this often ... */
export const FREE_SPIN_SECONDS = 10 * 60;
/** ... and at most this many wait for the player. */
export const MAX_FREE_SPINS = 6;
/** Spins a new player starts with. */
export const START_FREE_SPINS = 3;
/** Price of a spin without a free one. */
export const SPIN_CRYSTAL_PRICE = 15;
/** At least an epic aura comes within this many spins (the counter resets on every epic or better). */
export const PITY_SPINS = 25;
