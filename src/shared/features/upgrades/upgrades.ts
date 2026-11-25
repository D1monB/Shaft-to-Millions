// Pure rules of shop gear (pickaxes, bags, shoes): every item is bought once for money (decisions 027),
// kept forever, and the player equips any owned item of a slot.
import { BAGS } from "shared/config/bags";
import { GearBase } from "shared/config/gear";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";

export type GearSlot = "pickaxe" | "bag" | "shoes";

export const GEAR_SLOTS: ReadonlyArray<GearSlot> = ["pickaxe", "bag", "shoes"];

/** Items of each slot in shop order. The first item of a slot is the free starter. */
export const GEAR_BY_SLOT: { readonly [K in GearSlot]: ReadonlyArray<GearBase> } = {
	pickaxe: PICKAXES,
	bag: BAGS,
	shoes: SHOES,
};

export type EquippedGear = { [K in GearSlot]: string };

/** What the profile stores: owned item ids and the equipped id per slot. */
export interface GearState {
	owned: string[];
	equipped: EquippedGear;
}

export function isGearSlot(value: unknown): value is GearSlot {
	return value === "pickaxe" || value === "bag" || value === "shoes";
}

export function starterOf(slot: GearSlot): string {
	return GEAR_BY_SLOT[slot][0].id;
}

export function createStarterGear(): GearState {
	return {
		owned: GEAR_SLOTS.map(starterOf),
		equipped: { pickaxe: starterOf("pickaxe"), bag: starterOf("bag"), shoes: starterOf("shoes") },
	};
}

export interface FoundGear {
	readonly slot: GearSlot;
	readonly def: GearBase;
}

/** The item with this id, or undefined for anything else (wrong type, unknown id). Safe on client input. */
export function findGear(id: unknown): FoundGear | undefined {
	if (!typeIs(id, "string")) {
		return undefined;
	}
	for (const slot of GEAR_SLOTS) {
		const def = GEAR_BY_SLOT[slot].find((entry) => entry.id === id);
		if (def !== undefined) {
			return { slot, def };
		}
	}
	return undefined;
}

export type GearCardState = "equipped" | "owned" | "for-sale";

export function gearCardState(id: string, gear: GearState): GearCardState {
	if (gear.equipped.pickaxe === id || gear.equipped.bag === id || gear.equipped.shoes === id) {
		return "equipped";
	}
	return gear.owned.includes(id) ? "owned" : "for-sale";
}

export type BuyGearResult =
	| { readonly ok: true; readonly slot: GearSlot; readonly def: GearBase; readonly money: number }
	| {
			readonly ok: false;
			readonly reason: "unknown" | "owned" | "not-enough-money";
	  };

/**
 * Decides a purchase. Already owning the item is a refusal, so a double click never charges twice.
 * Does not change anything: the caller applies money and ownership in one go with `applyPurchase`.
 */
export function tryBuyGear(id: unknown, money: number, gear: GearState): BuyGearResult {
	const found = findGear(id);
	if (found === undefined) {
		return { ok: false, reason: "unknown" };
	}
	if (gear.owned.includes(found.def.id)) {
		return { ok: false, reason: "owned" };
	}
	if (!(money >= found.def.price)) {
		return { ok: false, reason: "not-enough-money" };
	}
	return { ok: true, slot: found.slot, def: found.def, money: money - found.def.price };
}

/**
 * Applies an approved purchase: adds the item and equips it (the player bought it to use it).
 * No yields inside, so together with the money write the purchase is atomic on the server.
 */
export function applyPurchase(result: { slot: GearSlot; def: GearBase }, gear: GearState): void {
	gear.owned.push(result.def.id);
	gear.equipped[result.slot] = result.def.id;
}

export type EquipGearResult =
	| { readonly ok: true; readonly slot: GearSlot }
	| { readonly ok: false; readonly reason: "unknown" | "not-owned" | "already" };

/** Only owned items can be equipped. Does not change anything. */
export function tryEquipGear(id: unknown, gear: GearState): EquipGearResult {
	const found = findGear(id);
	if (found === undefined) {
		return { ok: false, reason: "unknown" };
	}
	if (!gear.owned.includes(found.def.id)) {
		return { ok: false, reason: "not-owned" };
	}
	if (gear.equipped[found.slot] === found.def.id) {
		return { ok: false, reason: "already" };
	}
	return { ok: true, slot: found.slot };
}

/** The pickaxe tier of a gear item, or undefined when it is not a pickaxe. */
function pickaxeTierOf(def: GearBase): number | undefined {
	return PICKAXES.find((pickaxe) => pickaxe.id === def.id)?.tier;
}

/**
 * The "what next" goal: the first item of the slot, in shop order, that the player does not own (main line first).
 * With `pickaxeTier`, a cheaper side pickaxe of a higher tier wins over the main line, because it opens new ore sooner.
 */
export function nextGearToBuy(slot: GearSlot, gear: GearState, pickaxeTier?: number): GearBase | undefined {
	const candidates = GEAR_BY_SLOT[slot].filter((def) => !gear.owned.includes(def.id));
	const mainLine = candidates.find((def) => def.special === undefined);
	if (pickaxeTier === undefined) {
		return mainLine;
	}
	let breakthrough: GearBase | undefined;
	for (const def of candidates) {
		const tier = pickaxeTierOf(def);
		if (def.special !== undefined && tier !== undefined && tier > pickaxeTier) {
			if (breakthrough === undefined || def.price < breakthrough.price) {
				breakthrough = def;
			}
		}
	}
	if (mainLine === undefined) {
		return breakthrough ?? candidates[0];
	}
	return breakthrough !== undefined && breakthrough.price < mainLine.price ? breakthrough : mainLine;
}
