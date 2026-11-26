// The Robux store (decision 057). The developer chose to sell boosters, crystals and money. Rules that keep it legal:
// - crystals open chests, so a crystal pack makes every chest a paid random item for its buyer: chest odds are always
//   shown (config/chests.ts), and crystal packs are hidden and refused for players whose PolicyService says paid
//   random items are restricted (their crystals then stay earned-only);
// - money never buys anything random, so money packs and boosters are fine for everyone;
// - the game stays fully playable without Robux: crystals come from mining and quests, boosters cost crystals too.
// `productId` is the Developer Product id from the Creator Dashboard; while undefined the item is hidden.
import { BoosterId } from "./boosters";

export type StoreGrant =
	| { readonly kind: "boost"; readonly boosters: ReadonlyArray<BoosterId>; readonly seconds: number }
	| { readonly kind: "crystals"; readonly amount: number }
	/** Money grows with the buyer's deepest layer, so a pack stays worth the same Robux at any depth. */
	| { readonly kind: "money"; readonly amount: number };

export interface StoreProduct {
	readonly id: string;
	readonly productId: number | undefined;
	/** Shown on the button; must match the price on the dashboard. */
	readonly robuxPrice: number;
	readonly grant: StoreGrant;
}

export const STORE_PRODUCTS: ReadonlyArray<StoreProduct> = [
	{
		id: "boost_money",
		productId: undefined,
		robuxPrice: 49,
		grant: { kind: "boost", boosters: ["money"], seconds: 1800 },
	},
	{
		id: "boost_ore",
		productId: undefined,
		robuxPrice: 49,
		grant: { kind: "boost", boosters: ["ore"], seconds: 1800 },
	},
	{
		id: "boost_line",
		productId: undefined,
		robuxPrice: 79,
		grant: { kind: "boost", boosters: ["line"], seconds: 3600 },
	},
	{
		id: "boost_all",
		productId: undefined,
		robuxPrice: 199,
		grant: { kind: "boost", boosters: ["money", "ore", "line"], seconds: 7200 },
	},
	{ id: "crystals_s", productId: undefined, robuxPrice: 49, grant: { kind: "crystals", amount: 60 } },
	{ id: "crystals_m", productId: undefined, robuxPrice: 249, grant: { kind: "crystals", amount: 350 } },
	{ id: "crystals_l", productId: undefined, robuxPrice: 699, grant: { kind: "crystals", amount: 1_100 } },
	{ id: "money_s", productId: undefined, robuxPrice: 49, grant: { kind: "money", amount: 3_000 } },
	{ id: "money_m", productId: undefined, robuxPrice: 199, grant: { kind: "money", amount: 15_000 } },
	{ id: "money_l", productId: undefined, robuxPrice: 699, grant: { kind: "money", amount: 70_000 } },
];

/** Money packs: x this per layer below the first (income grows about 4x per layer, decision 056). */
export const MONEY_PACK_LAYER_GROWTH = 4;
