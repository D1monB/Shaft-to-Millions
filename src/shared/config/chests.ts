// Chests and their reward tables. The odds shown to players are computed from these weights, so the
// table IS the disclosure: change a weight and the UI shows the new odds automatically.
//
// Roblox policy (paid random items, checked 2026-11-24, policy page updated 2026-10-15):
// - show every possible item and its numerical odds BEFORE the player pays (Robux or Robux-bought currency);
// - players with PolicyService ArePaidRandomItemsRestricted must not open paid chests at all.
// Crystals (decision 043) are earned in game, and since decision 057 also sold for Robux (config/store.ts). So a chest
// opened with crystals counts as a paid random item: the odds are always shown, and crystal packs are hidden and
// refused for players with ArePaidRandomItemsRestricted, whose crystals therefore stay earned-only.
// Dollars never buy anything random: keep it that way.
import { ItemId } from "./items";

export type ChestId = "pet_chest" | "speed_chest" | "pickaxe_chest";

export interface RewardEntry {
	readonly item: ItemId;
	readonly weight: number;
}

export interface ChestDef {
	/** Price in crystals (decision 043). Odds are shown before opening (crystals are sold for Robux, decision 057). */
	readonly crystalPrice: number;
	/**
	 * Developer Product id for opening with Robux. Create the product on the Creator Dashboard and paste its
	 * id here. While undefined, the Robux button is hidden.
	 */
	readonly robuxProductId: number | undefined;
	/** Price shown on the button. Must match the Developer Product price on the dashboard. */
	readonly robuxPrice: number;
	readonly rewards: ReadonlyArray<RewardEntry>;
}

export const CHESTS: { readonly [K in ChestId]: ChestDef } = {
	pet_chest: {
		crystalPrice: 15,
		robuxProductId: undefined,
		robuxPrice: 49,
		rewards: [
			{ item: "pet_mole", weight: 45 },
			{ item: "pet_beetle", weight: 30 },
			{ item: "pet_moth", weight: 15 },
			{ item: "pet_lizard", weight: 8 },
			{ item: "pet_golem", weight: 2 },
		],
	},
	speed_chest: {
		crystalPrice: 10,
		robuxProductId: undefined,
		robuxPrice: 35,
		rewards: [
			{ item: "aura_breeze", weight: 45 },
			{ item: "aura_spark", weight: 30 },
			{ item: "aura_comet", weight: 15 },
			{ item: "aura_lightning", weight: 8 },
			{ item: "aura_storm", weight: 2 },
		],
	},
	pickaxe_chest: {
		crystalPrice: 20,
		robuxProductId: undefined,
		robuxPrice: 59,
		rewards: [
			{ item: "paura_glint", weight: 45 },
			{ item: "paura_ember", weight: 30 },
			{ item: "paura_quake", weight: 15 },
			{ item: "paura_prism", weight: 8 },
			{ item: "paura_core", weight: 2 },
		],
	},
};

export const CHEST_IDS: ReadonlyArray<ChestId> = ["pet_chest", "speed_chest", "pickaxe_chest"];

export function isChestId(value: unknown): value is ChestId {
	return typeIs(value, "string") && (CHESTS as Record<string, ChestDef | undefined>)[value] !== undefined;
}

/**
 * Most dollars one crystal may come back as through a chest item's resale. Above it, crystals would turn into a money
 * printer (tested in equipment.test.ts).
 */
export const CRYSTAL_RESALE_LIMIT = 50;
