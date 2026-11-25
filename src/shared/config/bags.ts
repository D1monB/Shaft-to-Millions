// Bags: how many pieces of ore the player can carry before selling or depositing. The first one is the starter.
// Capacity is the main pacing lever of manual mining: a bigger bag means fewer trips to the surface.
import type { GearBase } from "./gear";

export interface BagDef extends GearBase {
	readonly capacity: number;
}

export const BAGS: ReadonlyArray<BagDef> = [
	{ id: "bag_sack", name: "Полотняна торба", capacity: 25, price: 0, materials: {} },
	{ id: "bag_leather", name: "Шкіряна сумка", capacity: 50, price: 150, materials: {} },
	{ id: "bag_miner", name: "Рюкзак шахтаря", capacity: 100, price: 900, materials: { copper_ingot: 5 } },
	{ id: "bag_riveted", name: "Окутий рюкзак", capacity: 150, price: 2_500, materials: { iron_ingot: 10 } },
	{ id: "bag_reinforced", name: "Посилений рюкзак", capacity: 200, price: 6_000, materials: { iron_ingot: 15 } },
	{ id: "bag_silver", name: "Срібний ранець", capacity: 300, price: 15_000, materials: { silver_ingot: 10 } },
	{ id: "bag_cargo", name: "Вантажний ранець", capacity: 400, price: 40_000, materials: { gold_ingot: 10 } },
	{ id: "bag_obsidian", name: "Обсидіановий контейнер", capacity: 600, price: 100_000, materials: { obsidian: 30 } },
	{
		id: "bag_gravity",
		name: "Гравітаційний контейнер",
		capacity: 800,
		price: 250_000,
		materials: { gold_circuit: 10 },
	},
];
