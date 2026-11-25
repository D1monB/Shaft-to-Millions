// The tycoon production line (decisions 027): 12 machines in a fixed order, each turns an item of stage N into stage N + 1.
// An item is "ore + stage"; stage 0 is raw ore, stage 12 is the reactor. A new machine is a new entry here.
// Prices and times are first guesses to be tuned after the first play-test (docs/balance-tuning.md).

export interface LineMachineDef {
	/** Matches the model name prefix on the friend's map (M01_HydroWasher -> "M01"). */
	readonly id: string;
	/** Name of the item this machine makes (stage = position in the line + 1). */
	readonly price: number;
	/** Seconds to process one item at speed level 1. */
	readonly seconds: number;
}

export const LINE_MACHINES: ReadonlyArray<LineMachineDef> = [
	{ id: "M01", price: 150, seconds: 1.5 },
	{ id: "M02", price: 400, seconds: 1.5 },
	{ id: "M03", price: 1_000, seconds: 2 },
	{ id: "M04", price: 2_500, seconds: 2 },
	{ id: "M05", price: 6_000, seconds: 2.5 },
	{ id: "M06", price: 15_000, seconds: 2.5 },
	{ id: "M07", price: 40_000, seconds: 3 },
	{ id: "M08", price: 100_000, seconds: 3 },
	{ id: "M09", price: 250_000, seconds: 3.5 },
	{ id: "M10", price: 1_500_000, seconds: 3.5 },
	{ id: "M11", price: 4_000_000, seconds: 4 },
	{ id: "M12", price: 10_000_000, seconds: 4 },
];

/**
 * Value multiplier of an item per stage (index = stage). About x1.84 per stage, so a $10 ore becomes a ~$15 000
 * reactor. Must have LINE_MACHINES.size() + 1 entries.
 */
export const STAGE_VALUE: ReadonlyArray<number> = [1, 1.8, 3.3, 6, 11, 20, 37, 68, 125, 230, 420, 800, 1_500];

export type LineUpgradeTrack = "speed" | "duplicate" | "quality" | "capacity";

export const LINE_UPGRADE_TRACKS: ReadonlyArray<LineUpgradeTrack> = ["speed", "duplicate", "quality", "capacity"];

/**
 * One level of a machine upgrade. `value` meaning per track: speed = times faster, duplicate = chance of 2 outputs
 * (0..1), quality = value multiplier of what the machine makes, capacity = items that may wait in its queue.
 * `priceFactor` x machine price = cost of buying this level; level 1 is the base and is free.
 */
export interface LineUpgradeLevel {
	readonly priceFactor: number;
	readonly value: number;
}

export const LINE_UPGRADES: { readonly [K in LineUpgradeTrack]: ReadonlyArray<LineUpgradeLevel> } = {
	speed: [
		{ priceFactor: 0, value: 1 },
		{ priceFactor: 0.5, value: 1.25 },
		{ priceFactor: 1.5, value: 1.5 },
		{ priceFactor: 4, value: 2 },
		{ priceFactor: 10, value: 2.5 },
	],
	duplicate: [
		{ priceFactor: 0, value: 0 },
		{ priceFactor: 0.8, value: 0.05 },
		{ priceFactor: 2, value: 0.1 },
		{ priceFactor: 5, value: 0.15 },
		{ priceFactor: 12, value: 0.25 },
	],
	quality: [
		{ priceFactor: 0, value: 1 },
		{ priceFactor: 0.8, value: 1.05 },
		{ priceFactor: 2, value: 1.1 },
		{ priceFactor: 5, value: 1.2 },
		{ priceFactor: 12, value: 1.35 },
	],
	capacity: [
		{ priceFactor: 0, value: 10 },
		{ priceFactor: 0.3, value: 20 },
		{ priceFactor: 1, value: 35 },
		{ priceFactor: 3, value: 50 },
		{ priceFactor: 8, value: 80 },
	],
};

/** Items the start of the belt (intake) holds: a full bag fits. */
export const HOPPER_CAPACITY = 500;

/** Seconds the belt needs per raw ore while no machine is bought (it rides straight to the SellStation). */
export const BELT_SECONDS_PER_ITEM = 0.5;

/** The line runs at this share of its speed while the player is offline. */
export const OFFLINE_SPEED = 0.5;

/** Offline time counted at most (8 hours), so a long break does not become a jackpot. */
export const OFFLINE_MAX_SECONDS = 8 * 60 * 60;

/** Longest single simulation step; longer spans (offline) are cut into steps of this size. */
export const LINE_MAX_STEP = 5;

export function isLineUpgradeTrack(value: unknown): value is LineUpgradeTrack {
	return value === "speed" || value === "duplicate" || value === "quality" || value === "capacity";
}
