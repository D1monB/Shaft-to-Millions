// Shoes: walking speed. The shaft is deep, so speed is real progress: shorter trips up and down.
// The first pair is the starter, a bit faster than the Roblox default 16 (the developer found 16 too slow, decision 028).
// Ids are saved in profiles and never change; some display names changed with the new ores (decisions 027).
import type { GearBase } from "./gear";

export interface ShoesDef extends GearBase {
	readonly walkSpeed: number;
}

export const SHOES: ReadonlyArray<ShoesDef> = [
	{ id: "shoes_old", name: "Старі черевики", walkSpeed: 20, price: 0 },
	{ id: "shoes_miner", name: "Кросівки шахтаря", walkSpeed: 23, price: 120 },
	{ id: "shoes_light", name: "Легкі берці", walkSpeed: 26, price: 800 },
	{ id: "shoes_riveted", name: "Окуті чоботи", walkSpeed: 29, price: 2_500 },
	{ id: "shoes_spring", name: "Пружинні чоботи", walkSpeed: 32, price: 6_000 },
	{ id: "shoes_silver", name: "Сталеві кеди", walkSpeed: 36, price: 15_000 },
	{ id: "shoes_jet", name: "Реактивні кеди", walkSpeed: 40, price: 40_000 },
	{ id: "shoes_gold", name: "Золоті скороходи", walkSpeed: 45, price: 100_000 },
	{ id: "shoes_gravity", name: "Гравіботи", walkSpeed: 50, price: 250_000 },
];

/** Hard cap after all bonuses: the best shoes (50) with the strongest speed aura (+30%). Keeps platforming sane. */
export const MAX_WALK_SPEED = 65;
