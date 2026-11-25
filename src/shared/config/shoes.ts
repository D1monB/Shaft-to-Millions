// Shoes: walking speed. The shaft is deep, so speed is real progress: shorter trips up and down.
// The first pair is the starter. Roblox default WalkSpeed is 16.
// Ids are saved in profiles and never change; some display names changed with the new ores (decisions 027).
import type { GearBase } from "./gear";

export interface ShoesDef extends GearBase {
	readonly walkSpeed: number;
}

export const SHOES: ReadonlyArray<ShoesDef> = [
	{ id: "shoes_old", name: "Старі черевики", walkSpeed: 16, price: 0 },
	{ id: "shoes_miner", name: "Кросівки шахтаря", walkSpeed: 18, price: 120 },
	{ id: "shoes_light", name: "Легкі берці", walkSpeed: 20, price: 800 },
	{ id: "shoes_riveted", name: "Окуті чоботи", walkSpeed: 21, price: 2_500 },
	{ id: "shoes_spring", name: "Пружинні чоботи", walkSpeed: 23, price: 6_000 },
	{ id: "shoes_silver", name: "Сталеві кеди", walkSpeed: 24, price: 15_000 },
	{ id: "shoes_jet", name: "Реактивні кеди", walkSpeed: 26, price: 40_000 },
	{ id: "shoes_gold", name: "Золоті скороходи", walkSpeed: 28, price: 100_000 },
	{ id: "shoes_gravity", name: "Гравіботи", walkSpeed: 30, price: 250_000 },
];

/** Hard cap after all bonuses (auras). Higher speeds break platforming and look like a speed hack. */
export const MAX_WALK_SPEED = 40;
