// Taming creatures on the layers (decision 070): offer ore from the bag; maybe the creature becomes your pet.
import { CREATURES, CreatureDef } from "shared/config/retention";
import { INVENTORY_LIMIT } from "shared/config/items";

export function creatureOfLayer(layer: number): CreatureDef | undefined {
	return CREATURES.find((def) => def.layer === layer);
}

export type TameCheck =
	{ readonly ok: true } | { readonly ok: false; readonly reason: "layer" | "food" | "inventory-full" };

export function canOffer(def: CreatureDef, deepestLayer: number, foodInBag: number, inventorySize: number): TameCheck {
	if (!(deepestLayer >= def.layer)) {
		return { ok: false, reason: "layer" };
	}
	if (inventorySize >= INVENTORY_LIMIT) {
		return { ok: false, reason: "inventory-full" };
	}
	return foodInBag >= def.amount ? { ok: true } : { ok: false, reason: "food" };
}

/** One offering: `roll` is the server's Random in [0, 1). A broken roll never tames. */
export function tames(def: CreatureDef, roll: number): boolean {
	return roll === roll && roll >= 0 && roll < def.chance;
}
