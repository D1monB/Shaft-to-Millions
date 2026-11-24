// Bag levels: how many pieces of ore the player can carry before selling or depositing.
// Capacity is the main pacing lever of manual mining: a bigger bag means fewer trips to the surface.

export interface BagDef {
	readonly name: string;
	readonly capacity: number;
	readonly price: number;
}

export const BAGS: ReadonlyArray<BagDef> = [
	{ name: "Полотняна торба", capacity: 25, price: 0 },
	{ name: "Шкіряна сумка", capacity: 50, price: 150 },
	{ name: "Рюкзак шахтаря", capacity: 100, price: 900 },
	{ name: "Посилений рюкзак", capacity: 200, price: 6_000 },
	{ name: "Вантажний ранець", capacity: 400, price: 40_000 },
	{ name: "Гравітаційний контейнер", capacity: 800, price: 250_000 },
];
