// Quests (decision 055): three daily quests, a long story chain that walks the player from the first pickaxe to the
// deep layers, and a daily login streak. A new quest is a new entry here, never new code.
//
// Event kinds are counted when the thing happens (the server reports them); state kinds are read from the profile
// (how many machines the player owns, how deep they have been), so they also count progress made before the quest.
import { OreId } from "./ores";

export type QuestEventKind =
	| "mineOre" // pieces of ore put into the bag (optionally of one ore)
	| "emptyBlocks" // ore blocks mined out
	| "crits" // critical hits
	| "treasure" // treasure crates broken
	| "sellBag" // bags sold
	| "earnMoney" // dollars earned (sales and line income)
	| "lineSold" // items the line sold
	| "upgradeMachine" // machine or conveyor upgrades bought
	| "openChest"; // chests opened

export type QuestStateKind =
	| "machines" // machines owned
	| "layer" // deepest layer opened
	| "gear" // owns the gear item `gear`
	| "belt" // conveyor level
	| "drills"; // auto drills owned

export type QuestKind = QuestEventKind | QuestStateKind;

export interface QuestReward {
	readonly money?: number;
	readonly crystals?: number;
}

export interface QuestDef {
	readonly id: string;
	readonly kind: QuestKind;
	readonly target: number;
	/** mineOre only: count just this ore. */
	readonly ore?: OreId;
	/** gear only: the item id to own. */
	readonly gear?: string;
	readonly reward: QuestReward;
}

/**
 * Daily pool. Targets and money are for a player on layer 1; deeper players get bigger targets and money
 * (DAILY_TARGET_GROWTH, DAILY_MONEY_GROWTH per layer). Crystals stay the same: they buy the same chests at any depth.
 */
export const DAILY_QUESTS: ReadonlyArray<QuestDef> = [
	{ id: "d_mine", kind: "mineOre", target: 250, reward: { money: 400, crystals: 4 } },
	{ id: "d_blocks", kind: "emptyBlocks", target: 35, reward: { money: 400, crystals: 4 } },
	{ id: "d_crits", kind: "crits", target: 40, reward: { money: 300, crystals: 3 } },
	{ id: "d_sell", kind: "sellBag", target: 6, reward: { money: 300, crystals: 3 } },
	{ id: "d_earn", kind: "earnMoney", target: 3_000, reward: { money: 600, crystals: 5 } },
	{ id: "d_treasure", kind: "treasure", target: 1, reward: { money: 500, crystals: 6 } },
	{ id: "d_upgrade", kind: "upgradeMachine", target: 3, reward: { money: 500, crystals: 5 } },
	{ id: "d_line", kind: "lineSold", target: 150, reward: { money: 500, crystals: 4 } },
	{ id: "d_chest", kind: "openChest", target: 1, reward: { money: 300, crystals: 3 } },
];

/** Daily quests offered each day. */
export const DAILY_COUNT = 3;
/** Each layer deeper multiplies daily targets by this ... */
export const DAILY_TARGET_GROWTH = 1.6;
/** ... and daily money by this (deeper ore is worth more). */
export const DAILY_MONEY_GROWTH = 4;
/** A bag sale counts for "sell your bag" quests only with at least this many pieces in it. */
export const SELL_QUEST_MIN_ITEMS = 10;
/** Bonus for finishing all daily quests of a day. */
export const DAILY_ALL_DONE_REWARD: QuestReward = { crystals: 8 };

/** Login streak rewards, day 1..7; after day 7 the week starts again (a missed day starts at day 1). */
export const STREAK_REWARDS: ReadonlyArray<QuestReward> = [
	{ crystals: 2, money: 200 },
	{ crystals: 3, money: 400 },
	{ crystals: 4, money: 800 },
	{ crystals: 5, money: 1_500 },
	{ crystals: 6, money: 3_000 },
	{ crystals: 8, money: 6_000 },
	{ crystals: 20, money: 15_000 },
];

/**
 * The story chain, in order. One quest at a time; claiming it opens the next. It doubles as the tutorial (first steps)
 * and as the long-term goal list (late steps take days).
 */
export const CHAIN_QUESTS: ReadonlyArray<QuestDef> = [
	{ id: "c_first_ore", kind: "mineOre", target: 20, reward: { money: 60 } },
	{ id: "c_first_sale", kind: "sellBag", target: 1, reward: { money: 80 } },
	{ id: "c_shoes", kind: "gear", gear: "shoes_miner", target: 1, reward: { money: 150, crystals: 2 } },
	{ id: "c_copper_100", kind: "mineOre", ore: "copper", target: 150, reward: { money: 250 } },
	{ id: "c_bag", kind: "gear", gear: "bag_leather", target: 1, reward: { money: 300, crystals: 2 } },
	{ id: "c_machine_1", kind: "machines", target: 1, reward: { money: 400, crystals: 3 } },
	{ id: "c_line_50", kind: "lineSold", target: 50, reward: { money: 500 } },
	{ id: "c_pickaxe", kind: "gear", gear: "pickaxe_copper", target: 1, reward: { money: 600, crystals: 3 } },
	{ id: "c_layer_2", kind: "layer", target: 2, reward: { money: 1_000, crystals: 5 } },
	{ id: "c_iron_300", kind: "mineOre", ore: "iron", target: 300, reward: { money: 1_500 } },
	{ id: "c_machine_3", kind: "machines", target: 3, reward: { money: 2_000, crystals: 4 } },
	{ id: "c_upgrades_5", kind: "upgradeMachine", target: 5, reward: { money: 2_500, crystals: 4 } },
	{ id: "c_drill_1", kind: "drills", target: 1, reward: { money: 3_000, crystals: 5 } },
	{ id: "c_treasure_3", kind: "treasure", target: 3, reward: { money: 4_000, crystals: 6 } },
	{ id: "c_belt_2", kind: "belt", target: 2, reward: { money: 5_000, crystals: 4 } },
	{ id: "c_layer_3", kind: "layer", target: 3, reward: { money: 10_000, crystals: 8 } },
	{ id: "c_silver_600", kind: "mineOre", ore: "silver", target: 600, reward: { money: 15_000 } },
	{ id: "c_machine_6", kind: "machines", target: 6, reward: { money: 25_000, crystals: 8 } },
	{ id: "c_chests_5", kind: "openChest", target: 5, reward: { money: 20_000, crystals: 5 } },
	{ id: "c_earn_250k", kind: "earnMoney", target: 250_000, reward: { money: 40_000, crystals: 10 } },
	{ id: "c_layer_4", kind: "layer", target: 4, reward: { money: 80_000, crystals: 12 } },
	{ id: "c_gold_1000", kind: "mineOre", ore: "gold", target: 1_000, reward: { money: 120_000 } },
	{ id: "c_machine_9", kind: "machines", target: 9, reward: { money: 200_000, crystals: 12 } },
	{ id: "c_belt_4", kind: "belt", target: 4, reward: { money: 250_000, crystals: 10 } },
	{ id: "c_layer_5", kind: "layer", target: 5, reward: { money: 500_000, crystals: 20 } },
	{ id: "c_titanium_1500", kind: "mineOre", ore: "titanium", target: 1_500, reward: { money: 800_000 } },
	{ id: "c_iridium_200", kind: "mineOre", ore: "iridium", target: 200, reward: { money: 1_000_000, crystals: 25 } },
	{ id: "c_machine_12", kind: "machines", target: 12, reward: { money: 2_000_000, crystals: 30 } },
	{ id: "c_earn_50m", kind: "earnMoney", target: 50_000_000, reward: { money: 5_000_000, crystals: 50 } },
];

export function isStateKind(kind: QuestKind): kind is QuestStateKind {
	return kind === "machines" || kind === "layer" || kind === "gear" || kind === "belt" || kind === "drills";
}
