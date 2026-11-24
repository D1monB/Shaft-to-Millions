// Every ore in the game. A new ore is a new entry here, not new code.
// Balance notes: price grows faster than hardness, so deeper ore is worth the trip;
// `requiredTier` locks ore behind a better pickaxe (see pickaxes.ts) so progress is visible.

export type OreId = "coal" | "copper" | "iron" | "quartz" | "silver" | "gold" | "obsidian" | "cobalt";

export interface OreDef {
	readonly name: string;
	/** Sell price of one piece, in dollars. */
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
	coal: { name: "Вугілля", price: 2, hardness: 2, requiredTier: 1, respawnSeconds: 6, layer: 1, color: [45, 45, 50] },
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
		price: 9,
		hardness: 5,
		requiredTier: 1,
		respawnSeconds: 10,
		layer: 1,
		color: [170, 160, 150],
	},
	// A rare vein on layer 1 that the starter pickaxe cannot break: the first visible goal.
	quartz: {
		name: "Кварц",
		price: 25,
		hardness: 6,
		requiredTier: 2,
		respawnSeconds: 20,
		layer: 1,
		color: [235, 225, 255],
	},
	silver: {
		name: "Срібло",
		price: 20,
		hardness: 6,
		requiredTier: 2,
		respawnSeconds: 12,
		layer: 2,
		color: [210, 215, 225],
	},
	gold: {
		name: "Золото",
		price: 45,
		hardness: 9,
		requiredTier: 3,
		respawnSeconds: 16,
		layer: 2,
		color: [245, 200, 60],
	},
	obsidian: {
		name: "Обсидіан",
		price: 80,
		hardness: 12,
		requiredTier: 3,
		respawnSeconds: 18,
		layer: 3,
		color: [40, 20, 60],
	},
	cobalt: {
		name: "Кобальт",
		price: 150,
		hardness: 16,
		requiredTier: 4,
		respawnSeconds: 24,
		layer: 3,
		color: [40, 90, 220],
	},
};

/** Ids in display order (cheap to expensive). */
export const ORE_IDS: ReadonlyArray<OreId> = [
	"coal",
	"copper",
	"iron",
	"quartz",
	"silver",
	"gold",
	"obsidian",
	"cobalt",
];

export function isOreId(value: unknown): value is OreId {
	return typeIs(value, "string") && (ORES as Record<string, OreDef | undefined>)[value] !== undefined;
}
