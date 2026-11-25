// Bags: how many pieces of ore the player can carry before selling or dropping it into the line. The first one is
// the starter. Capacity is the main pacing lever of manual mining: a bigger bag means fewer trips to the surface.
// Ids are saved in profiles and never change; some display names changed with the new ores (decisions 027).
import type { GearBase } from "./gear";

export interface BagDef extends GearBase {
	readonly capacity: number;
}

export const BAGS: ReadonlyArray<BagDef> = [
	{ id: "bag_sack", name: "Полотняна торба", capacity: 25, price: 0 },
	{ id: "bag_leather", name: "Шкіряна сумка", capacity: 50, price: 150 },
	{ id: "bag_miner", name: "Рюкзак шахтаря", capacity: 100, price: 900 },
	{ id: "bag_riveted", name: "Окутий рюкзак", capacity: 150, price: 3_000 },
	{ id: "bag_reinforced", name: "Посилений рюкзак", capacity: 200, price: 8_000 },
	{ id: "bag_silver", name: "Сталевий ранець", capacity: 300, price: 20_000 },
	{ id: "bag_cargo", name: "Вантажний ранець", capacity: 400, price: 50_000 },
	{ id: "bag_obsidian", name: "Обсидіановий контейнер", capacity: 600, price: 150_000 },
	{ id: "bag_gravity", name: "Гравітаційний контейнер", capacity: 800, price: 400_000 },
];
