// Every ore in the game (decisions 031): one ore per layer of the pit, plus iridium, found only in the portal zone at
// the bottom of layer 5. Ids match the map author's ItemTemplates/<ore> folders. A new ore is a new entry here.
// Balance notes: price grows faster than hardness, so deeper ore is worth the trip;
// `requiredTier` locks ore behind a better pickaxe (see pickaxes.ts) so progress is visible.
// `price` is the raw-ore value; the tycoon line multiplies it by the stage it reaches (config/line.ts).

export type OreId = "copper" | "iron" | "silver" | "gold" | "titanium" | "iridium";

export interface OreDef {
	/** Sell price of one piece of raw ore, in dollars. */
	readonly price: number;
	/** Damage needed to break one node. Hits = ceil(hardness / pickaxe power). */
	readonly hardness: number;
	/** Minimum pickaxe tier that can mine this ore at all. */
	readonly requiredTier: number;
	/** Seconds until a broken node can be mined again by the same player. */
	readonly respawnSeconds: number;
	/** Layer where this ore is found (see layers.ts). */
	readonly layer: number;
	/** False: auto drills never mine it (iridium grows only in the portal zone, it must be mined by hand). */
	readonly drillable?: boolean;
	/** RGB 0-255. Plain numbers, not Color3, so this file also runs in headless tests. */
	readonly color: readonly [number, number, number];
}

export const ORES: { readonly [K in OreId]: OreDef } = {
	copper: {
		price: 5,
		hardness: 3,
		requiredTier: 1,
		respawnSeconds: 8,
		layer: 1,
		color: [214, 120, 52],
	},
	iron: {
		price: 12,
		hardness: 6,
		requiredTier: 2,
		respawnSeconds: 10,
		layer: 2,
		color: [150, 152, 158],
	},
	silver: {
		price: 30,
		hardness: 9,
		requiredTier: 3,
		respawnSeconds: 14,
		layer: 3,
		color: [222, 226, 236],
	},
	// Gold and titanium keep their ids; their layer and price moved (decisions 031), so old drills follow sanitize.
	gold: {
		price: 70,
		hardness: 13,
		requiredTier: 4,
		respawnSeconds: 18,
		layer: 4,
		color: [245, 200, 60],
	},
	titanium: {
		price: 150,
		hardness: 18,
		requiredTier: 5,
		respawnSeconds: 22,
		layer: 5,
		color: [110, 190, 240],
	},
	// The jackpot: only in the portal zone at the bottom of layer 5, hard and slow to come back, never drilled.
	iridium: {
		price: 400,
		hardness: 24,
		requiredTier: 5,
		respawnSeconds: 45,
		layer: 5,
		drillable: false,
		color: [170, 100, 240],
	},
};

/** Ids in display order (cheap to expensive). */
export const ORE_IDS: ReadonlyArray<OreId> = ["copper", "iron", "silver", "gold", "titanium", "iridium"];

export function isOreId(value: unknown): value is OreId {
	return typeIs(value, "string") && (ORES as Record<string, OreDef | undefined>)[value] !== undefined;
}
