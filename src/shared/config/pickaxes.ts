// Pickaxes. The first one is what every player starts with. The main line is ordered from weak to strong;
// side items (with `special`) trade one strength for another.
// `tier` decides WHICH ore can be mined (ores.ts requiredTier); `power` and `swingSeconds` decide HOW FAST.
// Ids are saved in profiles and never change; some display names changed with the new ores (decisions 027).
import type { GearBase } from "./gear";

export interface PickaxeDef extends GearBase {
	readonly tier: number;
	/** Damage per hit. */
	readonly power: number;
	/** Minimum seconds between hits. The server enforces it, the client only animates it. */
	readonly swingSeconds: number;
}

export const PICKAXES: ReadonlyArray<PickaxeDef> = [
	{ id: "pickaxe_wood", tier: 1, power: 1, swingSeconds: 0.55, price: 0 },
	{ id: "pickaxe_stone", tier: 1, power: 2, swingSeconds: 0.55, price: 60 },
	{ id: "pickaxe_copper", tier: 2, power: 2, swingSeconds: 0.45, price: 250 },
	{ id: "pickaxe_iron", tier: 2, power: 3, swingSeconds: 0.45, price: 900 },
	{
		id: "pickaxe_light",
		tier: 2,
		power: 2,
		swingSeconds: 0.25,
		price: 1_200,
		special: true,
	},
	{ id: "pickaxe_silver", tier: 3, power: 4, swingSeconds: 0.4, price: 2_800 },
	{ id: "pickaxe_gold", tier: 3, power: 5, swingSeconds: 0.4, price: 8_000 },
	{
		id: "pickaxe_hammer",
		tier: 4,
		// 13 = gold hardness: one hit, as its description promises (balance review 2026-11-25).
		power: 13,
		swingSeconds: 0.9,
		price: 30_000,
		special: true,
	},
	{ id: "pickaxe_obsidian", tier: 4, power: 7, swingSeconds: 0.35, price: 60_000 },
	{ id: "pickaxe_cobalt", tier: 5, power: 9, swingSeconds: 0.35, price: 200_000 },
	{ id: "pickaxe_drill", tier: 5, power: 12, swingSeconds: 0.3, price: 600_000 },
	{ id: "pickaxe_plasma", tier: 5, power: 25, swingSeconds: 0.3, price: 2_000_000 },
];
