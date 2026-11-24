// Auto drills: one per layer, unlocked after the layer is passed (the player reached the next layer's camp).
// Balance: a drill is roughly 10x slower than mining by hand, so it adds income while the player is away
// or busy, but never replaces manual mining. The buffer caps how much it can stockpile.

export interface DrillDef {
	readonly name: string;
	readonly price: number;
	/** Seconds of drilling per point of ore hardness: coal (2) takes 2x this, iron (5) takes 5x. */
	readonly secondsPerHardness: number;
	/** Pieces the drill holds when the warehouse is full. */
	readonly bufferCapacity: number;
}

export const DRILLS: { readonly [layer: number]: DrillDef | undefined } = {
	1: { name: "Бур Сірих Пластів", price: 2_000, secondsPerHardness: 6, bufferCapacity: 40 },
	2: { name: "Бур Іржавих Порожнин", price: 20_000, secondsPerHardness: 5, bufferCapacity: 60 },
	3: { name: "Бур Базальтової Глибини", price: 150_000, secondsPerHardness: 4, bufferCapacity: 80 },
};

/** Offline production is counted for at most this long, so a drill bought once does not print money forever. */
export const MAX_OFFLINE_DRILL_SECONDS = 8 * 3600;

/** Save key of a layer's drill. String keys keep the saved table a dictionary, never an array. */
export function drillKey(layer: number): string {
	return `layer${layer}`;
}
