// Shoe levels: walking speed. The shaft is deep, so speed is real progress: shorter trips up and down.
// Roblox default WalkSpeed is 16.

export interface ShoesDef {
	readonly name: string;
	readonly walkSpeed: number;
	readonly price: number;
}

export const SHOES: ReadonlyArray<ShoesDef> = [
	{ name: "Старі черевики", walkSpeed: 16, price: 0 },
	{ name: "Кросівки шахтаря", walkSpeed: 18, price: 120 },
	{ name: "Легкі берці", walkSpeed: 20, price: 800 },
	{ name: "Пружинні чоботи", walkSpeed: 23, price: 5_000 },
	{ name: "Реактивні кеди", walkSpeed: 26, price: 30_000 },
	{ name: "Гравіботи", walkSpeed: 30, price: 180_000 },
];

/** Hard cap after all bonuses (auras). Higher speeds break platforming and look like a speed hack. */
export const MAX_WALK_SPEED = 40;
