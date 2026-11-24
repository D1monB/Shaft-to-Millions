// Pickaxe levels, bought in order. Level 1 is what every player starts with.
// `tier` decides WHICH ore can be mined (ores.ts requiredTier); `power` decides HOW FAST.

export interface PickaxeDef {
	readonly name: string;
	readonly tier: number;
	/** Damage per hit. */
	readonly power: number;
	/** Minimum seconds between hits. The server enforces it, the client only animates it. */
	readonly swingSeconds: number;
	/** Price in dollars to buy this level. 0 for the starter. */
	readonly price: number;
}

export const PICKAXES: ReadonlyArray<PickaxeDef> = [
	{ name: "Залізна кирка", tier: 1, power: 1, swingSeconds: 0.5, price: 0 },
	{ name: "Сталева кирка", tier: 2, power: 2, swingSeconds: 0.45, price: 250 },
	{ name: "Обсидіанова кирка", tier: 3, power: 4, swingSeconds: 0.4, price: 3_000 },
	{ name: "Ручний бур", tier: 4, power: 7, swingSeconds: 0.35, price: 25_000 },
	{ name: "Плазмовий бур", tier: 5, power: 12, swingSeconds: 0.3, price: 150_000 },
];
