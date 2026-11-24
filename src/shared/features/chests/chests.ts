// Pure chest rules: odds shown to the player, the roll, and whether a dollar opening is allowed.
// The server rolls with its own Random; the client only ever displays odds and results.
import { CHESTS, ChestId } from "shared/config/chests";
import { INVENTORY_HARD_LIMIT, INVENTORY_LIMIT, ItemId } from "shared/config/items";

export interface OddsLine {
	readonly item: ItemId;
	/** 0..1. All lines of a chest add up to 1. */
	readonly chance: number;
}

function totalWeight(chestId: ChestId): number {
	let total = 0;
	for (const entry of CHESTS[chestId].rewards) {
		total += entry.weight;
	}
	return total;
}

/** Every possible reward with its exact probability. This is what the odds disclosure shows. */
export function chestOdds(chestId: ChestId): OddsLine[] {
	const total = totalWeight(chestId);
	return CHESTS[chestId].rewards.map((entry) => ({ item: entry.item, chance: entry.weight / total }));
}

/**
 * Picks a reward for a roll in [0, 1). Out-of-range or NaN rolls are clamped, so a bad random source can
 * never return "nothing" (the player paid) and never favours a rare item by accident.
 */
export function rollChest(chestId: ChestId, roll: number): ItemId {
	const rewards = CHESTS[chestId].rewards;
	const safe = roll === roll ? math.clamp(roll, 0, 0.999999) : 0;
	let cursor = safe * totalWeight(chestId);
	for (const entry of rewards) {
		if (cursor < entry.weight) {
			return entry.item;
		}
		cursor -= entry.weight;
	}
	return rewards[rewards.size() - 1].item;
}

export type DollarOpenCheck =
	{ readonly ok: true } | { readonly ok: false; readonly reason: "money" | "inventory-full" };

export function canOpenWithDollars(chestId: ChestId, money: number, inventorySize: number): DollarOpenCheck {
	if (inventorySize >= INVENTORY_LIMIT) {
		return { ok: false, reason: "inventory-full" };
	}
	if (!(money >= CHESTS[chestId].dollarPrice)) {
		return { ok: false, reason: "money" };
	}
	return { ok: true };
}

// ---------------------------------------------------------------- inventory

export interface OwnedItem {
	/** Unique per player, so two identical pets can be told apart (equip one, keep the other). */
	readonly uid: string;
	readonly item: ItemId;
}

/** Adds an item with a fresh uid. Returns the new entry, or undefined when the hard cap is reached. */
export function addItem(inventory: OwnedItem[], nextUid: number, item: ItemId): OwnedItem | undefined {
	if (inventory.size() >= INVENTORY_HARD_LIMIT) {
		return undefined;
	}
	const owned: OwnedItem = { uid: `i${nextUid}`, item };
	inventory.push(owned);
	return owned;
}

/** Removes by uid. Returns the removed entry. */
export function removeItem(inventory: OwnedItem[], uid: string): OwnedItem | undefined {
	const index = inventory.findIndex((entry) => entry.uid === uid);
	if (index < 0) {
		return undefined;
	}
	return inventory.remove(index);
}

/** True if this purchase receipt was already granted. */
export function wasGranted(purchaseIds: ReadonlyArray<string>, purchaseId: string): boolean {
	return purchaseIds.includes(purchaseId);
}

/** Remembered receipts. Older ones are dropped: Roblox only retries recent unprocessed receipts. */
export const MAX_REMEMBERED_PURCHASES = 100;

export function rememberPurchase(purchaseIds: string[], purchaseId: string): void {
	purchaseIds.push(purchaseId);
	while (purchaseIds.size() > MAX_REMEMBERED_PURCHASES) {
		purchaseIds.shift();
	}
}
