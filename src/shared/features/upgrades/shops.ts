// Physical gear shops (decision 058): a stand tagged Shop sells one slot (attribute ShopSlot = pickaxe | bag | shoes)
// or, without the attribute, everything. Pure rules, shared by the server check and the client panel.
import { GearSlot, isGearSlot } from "./upgrades";

/** The slot a shop sells: a gear slot, or "all" for a stand without (or with a broken) ShopSlot attribute. */
export type ShopSlot = GearSlot | "all";

export function shopSlotOf(attribute: unknown): ShopSlot {
	return isGearSlot(attribute) ? attribute : "all";
}

/** True when an item of `itemSlot` may be bought at a shop that sells `shop`. */
export function shopSells(shop: ShopSlot, itemSlot: GearSlot): boolean {
	return shop === "all" || shop === itemSlot;
}
