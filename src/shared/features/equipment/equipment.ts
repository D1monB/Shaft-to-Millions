// Pure equipment rules: slots, combined bonuses with caps, best loadout and selling spare items.
// The server applies these bonuses; the client shows the very same numbers.
import { ITEMS, ItemId, Rarity } from "shared/config/items";
import type { OwnedItem } from "shared/features/chests";

export interface Equipped {
	speedAura?: string;
	pickaxeAura?: string;
	pets: string[];
}

export const MAX_PETS = 3;

/**
 * Caps on combined bonuses. Why: without caps, stacking the best items would make early progress trivial.
 * Three legendary pets reach the pet cap exactly; the best aura stays below its cap on its own.
 */
export const BONUS_CAPS = {
	pets: 1.5,
	speed: 0.3,
	yield: 1,
} as const;

/** Dollars for selling a spare item. Far below a chest's price, so re-selling never pays for chests. */
export const ITEM_SELL_VALUE: { readonly [K in Rarity]: number } = {
	common: 50,
	uncommon: 120,
	rare: 300,
	epic: 800,
	legendary: 2_000,
};

export function newEquipped(): Equipped {
	return { pets: [] };
}

function findOwned(inventory: ReadonlyArray<OwnedItem>, uid: string | undefined): OwnedItem | undefined {
	return uid === undefined ? undefined : inventory.find((entry) => entry.uid === uid);
}

export interface Bonuses {
	/** Sum of pet bonuses after the cap (0.25 = +25%). */
	readonly petBonus: number;
	/** True when the pet sum was cut by the cap: the UI tells the player. */
	readonly petCapped: boolean;
	readonly sellMultiplier: number;
	readonly speedBonus: number;
	readonly yieldBonus: number;
}

/** Combined effect of everything equipped. Stale uids (sold or missing items) are ignored. */
export function computeBonuses(inventory: ReadonlyArray<OwnedItem>, equipped: Equipped): Bonuses {
	let petSum = 0;
	const counted = new Set<string>();
	for (const uid of equipped.pets) {
		const owned = findOwned(inventory, uid);
		// A uid listed twice must not count twice.
		if (owned !== undefined && !counted.has(uid) && ITEMS[owned.item].kind === "pet" && counted.size() < MAX_PETS) {
			counted.add(uid);
			petSum += ITEMS[owned.item].bonus;
		}
	}
	const speedItem = findOwned(inventory, equipped.speedAura);
	const yieldItem = findOwned(inventory, equipped.pickaxeAura);
	const speed =
		speedItem !== undefined && ITEMS[speedItem.item].kind === "speedAura" ? ITEMS[speedItem.item].bonus : 0;
	const yieldBonus =
		yieldItem !== undefined && ITEMS[yieldItem.item].kind === "pickaxeAura" ? ITEMS[yieldItem.item].bonus : 0;
	const petBonus = math.min(petSum, BONUS_CAPS.pets);
	return {
		petBonus,
		petCapped: petSum > BONUS_CAPS.pets,
		sellMultiplier: 1 + petBonus,
		speedBonus: math.min(speed, BONUS_CAPS.speed),
		yieldBonus: math.min(yieldBonus, BONUS_CAPS.yield),
	};
}

export function isEquipped(equipped: Equipped, uid: string): boolean {
	return equipped.speedAura === uid || equipped.pickaxeAura === uid || equipped.pets.includes(uid);
}

export type EquipResult =
	{ readonly ok: true } | { readonly ok: false; readonly reason: "not-owned" | "pet-slots-full" };

/** Equips an owned item. An aura replaces the current one; pets need a free slot. */
export function equipItem(inventory: ReadonlyArray<OwnedItem>, equipped: Equipped, uid: string): EquipResult {
	const owned = findOwned(inventory, uid);
	if (owned === undefined) {
		return { ok: false, reason: "not-owned" };
	}
	const kind = ITEMS[owned.item].kind;
	if (kind === "speedAura") {
		equipped.speedAura = uid;
	} else if (kind === "pickaxeAura") {
		equipped.pickaxeAura = uid;
	} else if (!equipped.pets.includes(uid)) {
		if (equipped.pets.size() >= MAX_PETS) {
			return { ok: false, reason: "pet-slots-full" };
		}
		equipped.pets.push(uid);
	}
	return { ok: true };
}

export function unequipItem(equipped: Equipped, uid: string): boolean {
	let changed = false;
	if (equipped.speedAura === uid) {
		equipped.speedAura = undefined;
		changed = true;
	}
	if (equipped.pickaxeAura === uid) {
		equipped.pickaxeAura = undefined;
		changed = true;
	}
	const index = equipped.pets.indexOf(uid);
	if (index >= 0) {
		equipped.pets.remove(index);
		changed = true;
	}
	return changed;
}

/** The strongest aura of each kind and the three strongest pets. */
export function bestLoadout(inventory: ReadonlyArray<OwnedItem>): Equipped {
	const byBonus = [...inventory].sort((a, b) => ITEMS[a.item].bonus > ITEMS[b.item].bonus);
	const result = newEquipped();
	for (const owned of byBonus) {
		const kind = ITEMS[owned.item].kind;
		if (kind === "speedAura" && result.speedAura === undefined) {
			result.speedAura = owned.uid;
		} else if (kind === "pickaxeAura" && result.pickaxeAura === undefined) {
			result.pickaxeAura = owned.uid;
		} else if (kind === "pet" && result.pets.size() < MAX_PETS) {
			result.pets.push(owned.uid);
		}
	}
	return result;
}

/** Sells a spare item: unequips it, removes it, returns the dollars to add (0 if it was not owned). */
export function sellItem(inventory: OwnedItem[], equipped: Equipped, uid: string): number {
	const index = inventory.findIndex((entry) => entry.uid === uid);
	if (index < 0) {
		return 0;
	}
	const owned = inventory[index];
	unequipItem(equipped, uid);
	inventory.remove(index);
	return ITEM_SELL_VALUE[ITEMS[owned.item].rarity];
}

/** Display value of an item for sorting and labels. */
export function itemSellValue(item: ItemId): number {
	return ITEM_SELL_VALUE[ITEMS[item].rarity];
}
