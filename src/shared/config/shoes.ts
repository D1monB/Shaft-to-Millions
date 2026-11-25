// Shoes: walking speed. The shaft is deep, so speed is real progress: shorter trips up and down.
// The first pair is the starter. Roblox default WalkSpeed is 16.
import type { GearBase } from "./gear";

export interface ShoesDef extends GearBase {
	readonly walkSpeed: number;
}

export const SHOES: ReadonlyArray<ShoesDef> = [
	{ id: "shoes_old", name: "Старі черевики", walkSpeed: 16, price: 0, materials: {} },
	{ id: "shoes_miner", name: "Кросівки шахтаря", walkSpeed: 18, price: 120, materials: {} },
	{ id: "shoes_light", name: "Легкі берці", walkSpeed: 20, price: 800, materials: { copper_ingot: 5 } },
	{ id: "shoes_riveted", name: "Окуті чоботи", walkSpeed: 21, price: 2_000, materials: { iron_ingot: 8 } },
	{ id: "shoes_spring", name: "Пружинні чоботи", walkSpeed: 23, price: 5_000, materials: { iron_ingot: 12 } },
	{ id: "shoes_silver", name: "Срібні кеди", walkSpeed: 24, price: 12_000, materials: { silver_ingot: 10 } },
	{ id: "shoes_jet", name: "Реактивні кеди", walkSpeed: 26, price: 30_000, materials: { copper_wire: 10 } },
	{ id: "shoes_gold", name: "Золоті скороходи", walkSpeed: 28, price: 80_000, materials: { gold_ingot: 10 } },
	{ id: "shoes_gravity", name: "Гравіботи", walkSpeed: 30, price: 180_000, materials: { gold_circuit: 5 } },
];

/** Hard cap after all bonuses (auras). Higher speeds break platforming and look like a speed hack. */
export const MAX_WALK_SPEED = 40;
