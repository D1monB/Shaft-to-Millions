// Auto drills: one per layer, unlocked after the layer is passed (the player reached the next layer's camp).
// Balance: a drill is roughly 10x slower than mining by hand, so it adds income while the player is away
// or busy, but never replaces manual mining. The buffer caps how much it can stockpile.

export interface DrillDef {
	readonly price: number;
	/** Seconds of drilling per point of ore hardness: copper (3) takes 3x this, iron (6) takes 6x. */
	readonly secondsPerHardness: number;
	/** Pieces the drill holds while the start of the belt is full. */
	readonly bufferCapacity: number;
}

export const DRILLS: { readonly [layer: number]: DrillDef | undefined } = {
	1: { price: 2_000, secondsPerHardness: 6, bufferCapacity: 40 },
	2: { price: 20_000, secondsPerHardness: 5, bufferCapacity: 60 },
	3: { price: 150_000, secondsPerHardness: 4, bufferCapacity: 80 },
	4: { price: 600_000, secondsPerHardness: 2, bufferCapacity: 100 },
	5: { price: 2_000_000, secondsPerHardness: 1.5, bufferCapacity: 120 },
};

/** Offline production is counted for at most this long, so a drill bought once does not print money forever. */
export const MAX_OFFLINE_DRILL_SECONDS = 8 * 3600;

/** Save key of a layer's drill. String keys keep the saved table a dictionary, never an array. */
export function drillKey(layer: number): string {
	return `layer${layer}`;
}
