// The player's base (decision 063): buildings on the plot, built and upgraded with real-time timers like in
// Clash of Clans. The office is the "town hall": no other building may be higher than it. A new building is a new
// entry here (plus its texts).

export type BuildingId = "office" | "market" | "warehouse" | "workshop" | "lab" | "hut";

export const BUILDING_IDS: ReadonlyArray<BuildingId> = ["office", "market", "warehouse", "workshop", "lab", "hut"];

/** The building that gates the level of all others. */
export const MAIN_BUILDING: BuildingId = "office";

export interface BuildingLevel {
	/** Dollars to start building this level. */
	readonly price: number;
	/** Real seconds the build takes. */
	readonly seconds: number;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/** Price and time of levels 1..6 (a normal building). Time grows into days, so the base is a goal for weeks. */
const LEVELS: ReadonlyArray<BuildingLevel> = [
	{ price: 500, seconds: MINUTE },
	{ price: 8_000, seconds: 10 * MINUTE },
	{ price: 100_000, seconds: HOUR },
	{ price: 900_000, seconds: 3 * HOUR },
	{ price: 6_500_000, seconds: 8 * HOUR },
	{ price: 32_000_000, seconds: 16 * HOUR },
];

function scaled(priceFactor: number, timeFactor: number): ReadonlyArray<BuildingLevel> {
	return LEVELS.map((level) => ({
		price: math.floor(level.price * priceFactor),
		seconds: math.floor(level.seconds * timeFactor),
	}));
}

export interface BuildingDef {
	readonly levels: ReadonlyArray<BuildingLevel>;
	/** What one level adds; its meaning depends on the building (see shared/features/base effects). */
	readonly perLevel: number;
	/** RGB of the roof and trim. */
	readonly color: readonly [number, number, number];
}

export const BUILDINGS: { readonly [K in BuildingId]: BuildingDef } = {
	// The gate: unlocks level N of every other building. No own bonus.
	office: { levels: scaled(1, 1.5), perLevel: 0, color: [245, 190, 60] },
	// +5% money from sales and the line per level.
	market: { levels: scaled(0.8, 1), perLevel: 0.05, color: [235, 100, 80] },
	// +8% bag capacity per level.
	warehouse: { levels: scaled(0.8, 1), perLevel: 0.08, color: [110, 170, 90] },
	// +5% line speed per level.
	workshop: { levels: scaled(1, 1), perLevel: 0.05, color: [90, 150, 240] },
	// +3 minutes to each booster bought with crystals per level.
	lab: { levels: scaled(0.9, 1.2), perLevel: 3 * MINUTE, color: [180, 100, 235] },
	// +3% ore from every hit per level.
	hut: { levels: scaled(0.7, 0.8), perLevel: 0.03, color: [190, 130, 80] },
};

/** Builders: one free; each extra one costs these crystals (the 2nd, then the 3rd). */
export const BUILDER_CRYSTAL_PRICES: ReadonlyArray<number> = [60, 200];

/** Skipping a timer costs one crystal per this many seconds left (at least one crystal). */
export const SKIP_SECONDS_PER_CRYSTAL = 5 * MINUTE;

export function isBuildingId(value: unknown): value is BuildingId {
	return typeIs(value, "string") && (BUILDINGS as Record<string, BuildingDef | undefined>)[value] !== undefined;
}
