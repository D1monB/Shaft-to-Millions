// Bags: how many pieces of ore the player can carry before selling or dropping it into the line. The first one is
// the starter. Capacity is the main pacing lever of manual mining: a bigger bag means fewer trips to the surface.
// Ids are saved in profiles and never change; some display names changed with the new ores (decisions 027).
import type { GearBase } from "./gear";

export interface BagDef extends GearBase {
	readonly capacity: number;
}

export const BAGS: ReadonlyArray<BagDef> = [
	{ id: "bag_sack", capacity: 25, price: 0 },
	{ id: "bag_leather", capacity: 50, price: 100 },
	{ id: "bag_miner", capacity: 100, price: 1_200 },
	{ id: "bag_riveted", capacity: 150, price: 5_000 },
	{ id: "bag_reinforced", capacity: 200, price: 28_000 },
	{ id: "bag_silver", capacity: 300, price: 190_000 },
	{ id: "bag_cargo", capacity: 400, price: 1_200_000 },
	{ id: "bag_obsidian", capacity: 600, price: 10_000_000 },
	{ id: "bag_gravity", capacity: 800, price: 70_000_000 },
];
