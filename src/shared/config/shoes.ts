// Shoes: walking speed. The shaft is deep, so speed is real progress: shorter trips up and down.
// The first pair is the starter, a bit faster than the Roblox default 16 (the developer found 16 too slow, decision 028).
// Ids are saved in profiles and never change; some display names changed with the new ores (decisions 027).
import type { GearBase } from "./gear";

export interface ShoesDef extends GearBase {
	readonly walkSpeed: number;
}

export const SHOES: ReadonlyArray<ShoesDef> = [
	{ id: "shoes_old", walkSpeed: 20, price: 0 },
	{ id: "shoes_miner", walkSpeed: 23, price: 90 },
	{ id: "shoes_light", walkSpeed: 26, price: 900 },
	{ id: "shoes_riveted", walkSpeed: 29, price: 4_000 },
	{ id: "shoes_spring", walkSpeed: 32, price: 21_000 },
	{ id: "shoes_silver", walkSpeed: 36, price: 150_000 },
	{ id: "shoes_jet", walkSpeed: 40, price: 1_200_000 },
	{ id: "shoes_gold", walkSpeed: 45, price: 8_500_000 },
	{ id: "shoes_gravity", walkSpeed: 50, price: 52_000_000 },
];

/** Hard cap after all bonuses: the best shoes (50) with the strongest speed aura (+30%). Keeps platforming sane. */
export const MAX_WALK_SPEED = 65;
