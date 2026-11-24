// Pure rules for buying the next level of a gear track (pickaxe, bag, shoes). Levels are bought in order.
import { BAGS } from "shared/config/bags";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";

export type UpgradeTrack = "pickaxe" | "bag" | "shoes";

export const UPGRADE_TRACK_IDS: ReadonlyArray<UpgradeTrack> = ["pickaxe", "bag", "shoes"];

interface LevelDef {
	readonly name: string;
	readonly price: number;
}

export const UPGRADE_TRACKS: { readonly [K in UpgradeTrack]: ReadonlyArray<LevelDef> } = {
	pickaxe: PICKAXES,
	bag: BAGS,
	shoes: SHOES,
};

export type UpgradeLevels = { [K in UpgradeTrack]: number };

export function isUpgradeTrack(value: unknown): value is UpgradeTrack {
	return typeIs(value, "string") && (UPGRADE_TRACKS as Record<string, unknown>)[value] !== undefined;
}

export function maxLevel(track: UpgradeTrack): number {
	return UPGRADE_TRACKS[track].size();
}

/** The level after `current`, or undefined at max level. */
export function nextLevelDef(track: UpgradeTrack, current: number): LevelDef | undefined {
	return UPGRADE_TRACKS[track][current]; // array index `current` is level `current + 1`
}

export type BuyResult =
	| { readonly ok: true; readonly money: number; readonly level: number; readonly price: number }
	| { readonly ok: false; readonly reason: "max-level" | "not-enough-money" | "stale-request" };

/**
 * Decides a purchase. `expectedLevel` is the level the client saw when the player clicked: if it differs
 * from the real level, the click is stale (e.g. a double click) and nothing is bought twice.
 */
export function tryBuyUpgrade(track: UpgradeTrack, money: number, current: number, expectedLevel: number): BuyResult {
	if (expectedLevel !== current) {
		return { ok: false, reason: "stale-request" };
	}
	const upcoming = nextLevelDef(track, current);
	if (upcoming === undefined) {
		return { ok: false, reason: "max-level" };
	}
	if (!(money >= upcoming.price)) {
		return { ok: false, reason: "not-enough-money" };
	}
	return { ok: true, money: money - upcoming.price, level: current + 1, price: upcoming.price };
}
