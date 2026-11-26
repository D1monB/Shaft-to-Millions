// Pickaxes: the map author's 10 pickaxe tools, from weak to strong (decision 037). The first is the starter.
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
	{ id: "pickaxe_wood", tool: "WoodPickaxe", tier: 1, power: 1, swingSeconds: 0.55, price: 0 },
	{ id: "pickaxe_copper", tool: "CopperPickaxe", tier: 2, power: 2, swingSeconds: 0.5, price: 150 },
	{ id: "pickaxe_iron", tool: "IronPickaxe", tier: 2, power: 3, swingSeconds: 0.45, price: 800 },
	{ id: "pickaxe_silver", tool: "SilverPickaxe", tier: 3, power: 4, swingSeconds: 0.42, price: 2_800 },
	{ id: "pickaxe_obsidian", tool: "ObsidianPickaxe", tier: 3, power: 5, swingSeconds: 0.4, price: 8_000 },
	{ id: "pickaxe_gold", tool: "GoldPickaxe", tier: 4, power: 7, swingSeconds: 0.38, price: 25_000 },
	{ id: "pickaxe_lava", tool: "LavaPickaxe", tier: 4, power: 9, swingSeconds: 0.36, price: 70_000 },
	{ id: "pickaxe_titanium", tool: "TitaniumPickaxe", tier: 5, power: 11, swingSeconds: 0.34, price: 200_000 },
	{ id: "pickaxe_luck", tool: "LuckPickaxe", tier: 5, power: 16, swingSeconds: 0.32, price: 600_000 },
	{ id: "pickaxe_iridium", tool: "IridiumPickaxe", tier: 5, power: 25, swingSeconds: 0.3, price: 2_000_000 },
];
