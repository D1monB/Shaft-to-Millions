// Boosters (decision 057): timed bonuses bought with crystals (the free path) or Robux (the store), or won from quests.
// The server keeps the end time per booster; buying again extends it, up to BOOST_MAX_SECONDS ahead.

export type BoosterId = "money" | "ore" | "line";

export const BOOSTER_IDS: ReadonlyArray<BoosterId> = ["money", "ore", "line"];

export interface BoosterDef {
	/** What it multiplies by while active: money from sales and the line, ore per hit, line speed. */
	readonly multiplier: number;
	/** Crystal price of one portion (CRYSTAL_PORTION_SECONDS); the free way to boost. */
	readonly crystalPrice: number;
}

export const BOOSTERS: { readonly [K in BoosterId]: BoosterDef } = {
	money: { multiplier: 2, crystalPrice: 25 },
	ore: { multiplier: 2, crystalPrice: 20 },
	line: { multiplier: 1.5, crystalPrice: 15 },
};

/** One portion bought with crystals lasts this long. */
export const CRYSTAL_PORTION_SECONDS = 15 * 60;

/** A booster never runs longer than this from now, however many are stacked. */
export const BOOST_MAX_SECONDS = 24 * 60 * 60;

export function isBoosterId(value: unknown): value is BoosterId {
	return value === "money" || value === "ore" || value === "line";
}
