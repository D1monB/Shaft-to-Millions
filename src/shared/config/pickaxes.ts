// Pickaxes: the map author's 10 pickaxe tools, from weak to strong (decision 037). The first is the starter.
// The first pickaxe of each tier is the gate to the next layer's ore, so it is the big purchase of a layer (decision 056).
// `tier` decides WHICH ore can be mined (ores.ts requiredTier); `power` and `swingSeconds` decide HOW FAST.
// Ids are saved in profiles and never change; some display names changed with the new ores (decisions 027).
import type { GearBase } from "./gear";

export interface PickaxeDef extends GearBase {
	readonly tier: number;
	/** Damage per hit. */
	readonly power: number;
	/** Minimum seconds between hits. The server enforces it, the client only animates it. */
	readonly swingSeconds: number;
	/** Name of the map author's Tool in ServerStorage.PickaxeTemplates that the player holds. */
	readonly tool: string;
}

export const PICKAXES: ReadonlyArray<PickaxeDef> = [
	{ id: "pickaxe_wood", tool: "WoodPickaxe", tier: 1, power: 1, swingSeconds: 0.8, price: 0 },
	{ id: "pickaxe_copper", tool: "CopperPickaxe", tier: 2, power: 2, swingSeconds: 0.75, price: 13_000 },
	{ id: "pickaxe_iron", tool: "IronPickaxe", tier: 2, power: 3, swingSeconds: 0.7, price: 42_000 },
	{ id: "pickaxe_silver", tool: "SilverPickaxe", tier: 3, power: 4, swingSeconds: 0.66, price: 290_000 },
	{ id: "pickaxe_obsidian", tool: "ObsidianPickaxe", tier: 3, power: 5, swingSeconds: 0.62, price: 900_000 },
	{ id: "pickaxe_gold", tool: "GoldPickaxe", tier: 4, power: 7, swingSeconds: 0.58, price: 3_200_000 },
	{ id: "pickaxe_lava", tool: "LavaPickaxe", tier: 4, power: 9, swingSeconds: 0.55, price: 10_000_000 },
	{ id: "pickaxe_titanium", tool: "TitaniumPickaxe", tier: 5, power: 11, swingSeconds: 0.52, price: 13_000_000 },
	{ id: "pickaxe_luck", tool: "LuckPickaxe", tier: 5, power: 16, swingSeconds: 0.5, price: 52_000_000 },
	{ id: "pickaxe_iridium", tool: "IridiumPickaxe", tier: 5, power: 25, swingSeconds: 0.48, price: 175_000_000 },
];
