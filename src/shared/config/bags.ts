// Bags: how many pieces of ore the player can carry before selling or dropping it into the line. The first one is
// the starter. Capacity is the main pacing lever of manual mining: a bigger bag means fewer trips to the surface.
// Ids are saved in profiles and never change; some display names changed with the new ores (decisions 027).
import type { GearBase } from "./gear";

export interface BagDef extends GearBase {
	readonly capacity: number;
}

export const BAGS: ReadonlyArray<BagDef> = [
	{ id: "bag_sack", capacity: 25, price: 0 },
	{ id: "bag_leather", capacity: 50, price: 300 },
	{ id: "bag_miner", capacity: 100, price: 2_500 },
	{ id: "bag_riveted", capacity: 150, price: 15_000 },
	{ id: "bag_reinforced", capacity: 200, price: 90_000 },
	{ id: "bag_silver", capacity: 300, price: 600_000 },
	{ id: "bag_cargo", capacity: 400, price: 4_000_000 },
	{ id: "bag_obsidian", capacity: 600, price: 30_000_000 },
	{ id: "bag_gravity", capacity: 800, price: 200_000_000 },
];
