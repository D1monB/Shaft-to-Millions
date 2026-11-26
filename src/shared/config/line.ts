// The tycoon production line (decisions 027): 12 machines in a fixed order, each turns an item of stage N into stage N + 1.
// An item is "ore + stage"; stage 0 is raw ore, stage 12 is the reactor. A new machine is a new entry here.
// Long progression (decision 056): machine prices grow about x2.5 each, so the line is built over layers 1-4, and
// processing multiplies ore value at most x10 (plus quality), not x1500: mining deeper ore matters more than the line.

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
	{ id: "M02", price: 800, seconds: 1.5 },
	{ id: "M03", price: 3_000, seconds: 2 },
	{ id: "M04", price: 11_000, seconds: 2 },
	{ id: "M05", price: 45_000, seconds: 2.5 },
	{ id: "M06", price: 160_000, seconds: 2.5 },
	{ id: "M07", price: 580_000, seconds: 3 },
	{ id: "M08", price: 2_100_000, seconds: 3 },
	{ id: "M09", price: 7_800_000, seconds: 3.5 },
	{ id: "M10", price: 26_000_000, seconds: 3.5 },
	{ id: "M11", price: 88_000_000, seconds: 4 },
	{ id: "M12", price: 300_000_000, seconds: 4 },
];

/**
 * Value multiplier of an item per stage (index = stage). Flat on purpose (decision 056): a reactor is worth 10 raw ores,
 * so deeper ore stays the main way to grow. Must have LINE_MACHINES.size() + 1 entries.
 */
export const STAGE_VALUE: ReadonlyArray<number> = [1, 1.3, 1.6, 2, 2.4, 2.9, 3.5, 4.2, 5, 6, 7.2, 8.6, 10];

export type LineUpgradeTrack = "speed" | "duplicate" | "quality" | "capacity";

export const LINE_UPGRADE_TRACKS: ReadonlyArray<LineUpgradeTrack> = ["speed", "duplicate", "quality", "capacity"];

/**
 * One level of a machine upgrade. `value` meaning per track: speed = times faster, duplicate = chance of 2 outputs
 * (0..1), quality = bonus ADDED to the item's value share (decision 056: bonuses of all machines add up, they do not
 * multiply), capacity = items that may wait in its queue.
 * `priceFactor` x machine price = cost of buying this level; level 1 is the base and is free.
 */
export interface LineUpgradeLevel {
	readonly priceFactor: number;
	readonly value: number;
}

export const LINE_UPGRADES: { readonly [K in LineUpgradeTrack]: ReadonlyArray<LineUpgradeLevel> } = {
	speed: [
		{ priceFactor: 0, value: 1 },
		{ priceFactor: 0.6, value: 1.25 },
		{ priceFactor: 2, value: 1.5 },
		{ priceFactor: 6, value: 2 },
		{ priceFactor: 18, value: 2.5 },
	],
	duplicate: [
		{ priceFactor: 0, value: 0 },
		{ priceFactor: 1, value: 0.02 },
		{ priceFactor: 3, value: 0.04 },
		{ priceFactor: 9, value: 0.07 },
		{ priceFactor: 25, value: 0.1 },
	],
	quality: [
		{ priceFactor: 0, value: 0 },
		{ priceFactor: 1, value: 0.02 },
		{ priceFactor: 3, value: 0.05 },
		{ priceFactor: 9, value: 0.09 },
		{ priceFactor: 25, value: 0.14 },
	],
	capacity: [
		{ priceFactor: 0, value: 10 },
		{ priceFactor: 0.4, value: 20 },
		{ priceFactor: 1.5, value: 35 },
		{ priceFactor: 5, value: 50 },
		{ priceFactor: 15, value: 80 },
	],
};

/**
 * Conveyor levels (decision 054): the whole line (belt and every machine) runs `speed` times faster. Level 1 is the
 * base and is free; `price` buys that level.
 */
export interface BeltLevel {
	readonly price: number;
	readonly speed: number;
}

export const BELT_LEVELS: ReadonlyArray<BeltLevel> = [
	{ price: 0, speed: 1 },
	{ price: 9_000, speed: 1.15 },
	{ price: 100_000, speed: 1.3 },
	{ price: 1_000_000, speed: 1.5 },
	{ price: 8_000_000, speed: 1.75 },
	{ price: 60_000_000, speed: 2 },
];

/**
 * The whole line runs at this share of the machine times at conveyor level 1 (decision 068: the belt felt far too
 * fast); conveyor levels speed it up to x2 of this.
 */
export const LINE_BASE_SPEED = 0.6;

/** How fast the belt itself visibly moves (studs per second) at conveyor level 1; grows with the level. */
export const BELT_VISUAL_SPEED = 1.5;

/** The three upgrades of the belt itself, opened by a prompt anywhere on the conveyor (decision 069). */
export type BeltTrack = "speed" | "capacity" | "polish";

export const BELT_TRACKS: ReadonlyArray<BeltTrack> = ["speed", "capacity", "polish"];

export interface BeltTrackLevel {
	readonly price: number;
	readonly value: number;
}

/** Items waiting at the start of the belt (the silo). Level 1 is free. */
export const SILO_LEVELS: ReadonlyArray<BeltTrackLevel> = [
	{ price: 0, value: 500 },
	{ price: 4_000, value: 750 },
	{ price: 40_000, value: 1_100 },
	{ price: 600_000, value: 1_600 },
	{ price: 9_000_000, value: 2_500 },
];

/** Polishing on the way: money bonus of everything the line sells (0.03 = +3%). */
export const POLISH_LEVELS: ReadonlyArray<BeltTrackLevel> = [
	{ price: 0, value: 0 },
	{ price: 7_000, value: 0.03 },
	{ price: 80_000, value: 0.06 },
	{ price: 1_200_000, value: 0.1 },
	{ price: 20_000_000, value: 0.15 },
];

export function isBeltTrack(value: unknown): value is BeltTrack {
	return value === "speed" || value === "capacity" || value === "polish";
}

/** Items the start of the belt (intake) holds at silo level 1: a full bag fits. */
export const HOPPER_CAPACITY = 500;

/** Seconds the belt needs per raw ore while no machine is bought (it rides straight to the SellStation). */
export const BELT_SECONDS_PER_ITEM = 0.5;

/** The line runs at this share of its speed while the player is offline. */
export const OFFLINE_SPEED = 0.5;

/** Offline time counted at most (8 hours), so a long break is no jackpot. */
export const OFFLINE_MAX_SECONDS = 8 * 60 * 60;

/** Longest single simulation step; longer spans (offline) are cut into steps of this size. */
export const LINE_MAX_STEP = 5;

export function isLineUpgradeTrack(value: unknown): value is LineUpgradeTrack {
	return value === "speed" || value === "duplicate" || value === "quality" || value === "capacity";
}
