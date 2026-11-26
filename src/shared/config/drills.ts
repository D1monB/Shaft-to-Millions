// Auto drills: one per layer, unlocked after the layer is passed (the player reached the next layer's camp).
// Balance: a drill is roughly 10x slower than mining by hand, so it adds income while the player is away
// or busy, but never replaces manual mining. The buffer caps how much it can stockpile.

export interface DrillDef {
	readonly price: number;
	/** Seconds of drilling per point of ore hardness: copper (1) takes 1x this, iron (2) takes 2x. */
	readonly secondsPerHardness: number;
	/** Pieces the drill holds while the start of the belt is full. */
	readonly bufferCapacity: number;
}

export const DRILLS: { readonly [layer: number]: DrillDef | undefined } = {
	// Hardness became "damage per piece" (decision 052); these keep the old seconds per piece (18, 30, 36, 26, 27).
	1: { price: 5_000, secondsPerHardness: 18, bufferCapacity: 40 },
	2: { price: 22_000, secondsPerHardness: 15, bufferCapacity: 60 },
	3: { price: 80_000, secondsPerHardness: 9, bufferCapacity: 80 },
	4: { price: 340_000, secondsPerHardness: 3.7, bufferCapacity: 100 },
	5: { price: 1_200_000, secondsPerHardness: 2.5, bufferCapacity: 120 },
};

/**
 * Drill levels (decision 059): `speed` x faster, `buffer` x more room, for `priceFactor` x the drill's price. Level 1 is
 * the drill as bought. A drill is the player's passive income, so its levels are a long goal of their own.
 */
export interface DrillLevel {
	readonly priceFactor: number;
	readonly speed: number;
	readonly buffer: number;
}

export const DRILL_LEVELS: ReadonlyArray<DrillLevel> = [
	{ priceFactor: 0, speed: 1, buffer: 1 },
	{ priceFactor: 1.5, speed: 1.3, buffer: 1.5 },
	{ priceFactor: 4, speed: 1.7, buffer: 2 },
	{ priceFactor: 10, speed: 2.2, buffer: 2.5 },
	{ priceFactor: 25, speed: 2.8, buffer: 3 },
	{ priceFactor: 60, speed: 3.5, buffer: 4 },
];

/** Offline production is counted for at most this long, so a drill bought once does not print money forever. */
export const MAX_OFFLINE_DRILL_SECONDS = 8 * 3600;

/** Save key of a layer's drill. String keys keep the saved table a dictionary, never an array. */
export function drillKey(layer: number): string {
	return `layer${layer}`;
}
