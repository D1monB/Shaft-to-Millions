// What every piece of shop gear (pickaxe, bag, shoes) has in common. The lists live in pickaxes.ts, bags.ts, shoes.ts.
// Each item is bought once and kept: the player switches between owned items freely.
import type { ResourceId } from "./resources";

/** Ingots, ore or parts taken from the warehouse on purchase, on top of the money price. */
export type GearMaterials = { readonly [K in ResourceId]?: number };

export interface GearBase {
	/** Unique across ALL gear (prefixed by slot), saved in profiles: never rename an id. */
	readonly id: string;
	readonly name: string;
	/** Dollars. 0 for the starter item. */
	readonly price: number;
	readonly materials: GearMaterials;
	/** A side item: different strengths instead of strictly better. Its short pitch for the card. */
	readonly special?: string;
}
