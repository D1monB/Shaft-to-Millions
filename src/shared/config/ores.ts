// Every ore in the game (decisions 027: the friend's 6 ores on the 5 floors of his pit). A new ore is a new entry here.
// Balance notes: price grows faster than hardness, so deeper ore is worth the trip;
// `requiredTier` locks ore behind a better pickaxe (see pickaxes.ts) so progress is visible.
// `price` is the raw-ore value; the tycoon line multiplies it by the stage it reaches (config/line.ts).

export type OreId = "copper" | "iron" | "gold" | "titanium" | "obsidian" | "etherium";

export interface OreDef {
	readonly name: string;
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
	/** RGB 0-255. Plain numbers, not Color3, so this file also runs in headless tests. */
	readonly color: readonly [number, number, number];
}

export const ORES: { readonly [K in OreId]: OreDef } = {
	copper: {
		name: "Мідь",
		price: 5,
		hardness: 3,
		requiredTier: 1,
		respawnSeconds: 8,
		layer: 1,
		color: [200, 110, 60],
	},
	iron: {
		name: "Залізо",
		price: 12,
		hardness: 6,
		requiredTier: 2,
		respawnSeconds: 10,
		layer: 2,
		color: [170, 160, 150],
	},
	gold: {
		name: "Золото",
		price: 30,
		hardness: 9,
		requiredTier: 3,
		respawnSeconds: 14,
		layer: 3,
		color: [245, 200, 60],
	},
	titanium: {
		name: "Титан",
		price: 70,
		hardness: 13,
		requiredTier: 4,
		respawnSeconds: 18,
		layer: 4,
		color: [150, 175, 200],
	},
	obsidian: {
		name: "Обсидіан",
		price: 150,
		hardness: 18,
		requiredTier: 5,
		respawnSeconds: 22,
		layer: 5,
		color: [40, 20, 60],
	},
	// The rare jackpot of the deepest floor: hard and slow to come back.
	etherium: {
		name: "Ефіріум",
		price: 400,
		hardness: 24,
		requiredTier: 5,
		respawnSeconds: 45,
		layer: 5,
		color: [120, 240, 230],
	},
};

/** Ids in display order (cheap to expensive). */
export const ORE_IDS: ReadonlyArray<OreId> = ["copper", "iron", "gold", "titanium", "obsidian", "etherium"];

export function isOreId(value: unknown): value is OreId {
	return typeIs(value, "string") && (ORES as Record<string, OreDef | undefined>)[value] !== undefined;
}
