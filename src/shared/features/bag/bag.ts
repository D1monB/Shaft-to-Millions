// Pure bag rules: ore the player carries, limited by the capacity of their bag level.
import { BAGS } from "shared/config/bags";
import { ORE_IDS, OreId } from "shared/config/ores";

/** Ore counts by id. Missing id = 0. */
export type OreCounts = { [K in OreId]?: number };

export function bagCapacity(level: number): number {
	const safe = level === level ? math.clamp(math.floor(level), 1, BAGS.size()) : 1;
	return BAGS[safe - 1].capacity;
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
