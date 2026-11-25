// Pure rules of shop gear (pickaxes, bags, shoes): every item is bought once for money plus materials
// from the warehouse, kept forever, and the player equips any owned item of a slot.
import { BAGS } from "shared/config/bags";
import { GearBase, GearMaterials } from "shared/config/gear";
import { PICKAXES } from "shared/config/pickaxes";
import { RESOURCE_IDS, ResourceId } from "shared/config/resources";
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

/** Stock the purchase takes materials from (the warehouse). */
export type MaterialStock = { [K in ResourceId]?: number };

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

/** The materials of an item in a fixed order (resource order), so the UI and messages never jump around. */
export function materialList(materials: GearMaterials): Array<{ readonly id: ResourceId; readonly amount: number }> {
	const list: Array<{ id: ResourceId; amount: number }> = [];
	for (const id of RESOURCE_IDS) {
		const amount = materials[id];
		if (amount !== undefined && amount > 0) {
			list.push({ id, amount });
		}
	}
	return list;
}

export interface MissingMaterial {
	readonly id: ResourceId;
	readonly need: number;
	readonly have: number;
}

/** Materials the stock lacks for this item. Empty = enough of everything. Broken stock counts as 0. */
export function missingMaterials(def: GearBase, stock: MaterialStock): MissingMaterial[] {
	const missing: MissingMaterial[] = [];
	for (const entry of materialList(def.materials)) {
		const raw = stock[entry.id];
		const have = raw !== undefined && raw === raw && raw > 0 ? raw : 0;
		if (have < entry.amount) {
			missing.push({ id: entry.id, need: entry.amount, have });
		}
	}
	return missing;
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
			readonly reason: "unknown" | "owned" | "not-enough-money" | "not-enough-materials";
	  };

/**
 * Decides a purchase. Already owning the item is a refusal, so a double click never charges twice.
 * Does not change anything: the caller applies money, materials (`materialList(def.materials)`) and ownership
 * in one go with `applyPurchase`.
 */
export function tryBuyGear(id: unknown, money: number, stock: MaterialStock, gear: GearState): BuyGearResult {
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
	if (missingMaterials(found.def, stock).size() > 0) {
		return { ok: false, reason: "not-enough-materials" };
	}
	return { ok: true, slot: found.slot, def: found.def, money: money - found.def.price };
}

/**
 * Applies an approved purchase: takes the materials, adds the item and equips it (the player bought it to use it).
 * No yields inside, so together with the money write the purchase is atomic on the server.
 */
export function applyPurchase(result: { slot: GearSlot; def: GearBase }, stock: MaterialStock, gear: GearState): void {
	for (const entry of materialList(result.def.materials)) {
		const left = (stock[entry.id] ?? 0) - entry.amount;
		stock[entry.id] = left > 0 ? left : undefined;
	}
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

/** The first item of the slot, in shop order, that the player does not own: the "what next" goal. */
export function nextGearToBuy(slot: GearSlot, gear: GearState): GearBase | undefined {
	return GEAR_BY_SLOT[slot].find((def) => def.special === undefined && !gear.owned.includes(def.id));
}
