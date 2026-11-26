// Pure bag rules: ore the player carries, limited by the capacity of the equipped bag.
import { BAGS } from "shared/config/bags";
import { ORE_IDS, OreId } from "shared/config/ores";

/** Ore counts by id. Missing id = 0. */
export type OreCounts = { [K in OreId]?: number };

/**
 * Capacity of the bag with this id. An unknown id falls back to the starter bag. `bonus` (0.1 = +10%, the base's
 * warehouse, decision 063) is clamped to [0, 1]; broken input counts as 0.
 */
export function bagCapacity(id: string, bonus = 0): number {
	const capacity = (BAGS.find((def) => def.id === id) ?? BAGS[0]).capacity;
	const extra = bonus === bonus ? math.clamp(bonus, 0, 1) : 0;
	// +0.5 guards against float error (e.g. 25 x 1.4 = 34.999...).
	return math.floor(capacity * (1 + extra) + 0.000001);
}

/** Total pieces in the bag. Only known ore ids count, so junk keys in a save cannot fill the bag. */
export function bagTotal(bag: OreCounts): number {
	let total = 0;
	for (const id of ORE_IDS) {
		total += bag[id] ?? 0;
	}
	return total;
}

export function bagFreeSpace(bag: OreCounts, capacity: number): number {
	return math.max(0, capacity - bagTotal(bag));
}

/**
 * Adds up to `amount` pieces, never above capacity. Returns how many were actually added, so the caller
 * can tell the player when something did not fit. Bad amounts add nothing.
 */
export function addToBag(bag: OreCounts, oreId: OreId, amount: number, capacity: number): number {
	if (!(amount > 0) || amount === math.huge) {
		return 0;
	}
	const added = math.min(math.floor(amount), bagFreeSpace(bag, capacity));
	if (added > 0) {
		bag[oreId] = (bag[oreId] ?? 0) + added;
	}
	return added;
}
