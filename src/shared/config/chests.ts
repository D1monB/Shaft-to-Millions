// Chests and their reward tables. The odds shown to players are computed from these weights, so the
// table IS the disclosure: change a weight and the UI shows the new odds automatically.
//
// Roblox policy (paid random items, checked 2026-11-24, policy page updated 2026-10-15):
// - show every possible item and its numerical odds BEFORE the player pays (Robux or Robux-bought currency);
// - players with PolicyService ArePaidRandomItemsRestricted must not open paid chests at all.
// Dollars are earned in game and are NEVER sold for Robux, so opening with dollars is not a paid random item.
// Keep it that way: selling dollars for Robux would put every chest under the policy.
import { ItemId } from "./items";

export type ChestId = "pet_chest" | "speed_chest" | "pickaxe_chest";

export interface RewardEntry {
	readonly item: ItemId;
	readonly weight: number;
}

export interface ChestDef {
	readonly name: string;
	readonly description: string;
	readonly dollarPrice: number;
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
		name: "Скриня улюбленців",
		description: "Улюбленці додають відсоток до ціни всього, що ти продаєш.",
		dollarPrice: 1_500,
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
		name: "Скриня швидкості",
		description: "Аура швидкості прискорює біг (разом із взуттям).",
		dollarPrice: 1_000,
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
		name: "Скриня кирки",
		description: "Аура кирки дає шанс видобути більше руди з кожного блоку.",
		dollarPrice: 2_000,
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
