// What every piece of shop gear (pickaxe, bag, shoes) has in common. The lists live in pickaxes.ts, bags.ts, shoes.ts.
// Each item is bought once for money only (decisions 027) and kept: the player switches between owned items freely.

export interface GearBase {
	/** Unique across ALL gear (prefixed by slot), saved in profiles: never rename an id (the display name may change). */
	readonly id: string;
	/** Dollars. 0 for the starter item. */
	readonly price: number;
	/** A side item: different strengths instead of strictly better. Its pitch is the text gear.<id>.special. */
	readonly special?: true;
}
