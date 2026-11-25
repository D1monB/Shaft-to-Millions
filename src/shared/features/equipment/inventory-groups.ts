// How the inventory is shown: one card per kind of item instead of one per copy, so ten moles are "Кротик ×10",
// not ten identical rows. Pure, so the grouping and its order are unit tested.
import { ITEMS, ItemId, ItemKind } from "shared/config/items";
import type { OwnedItem } from "shared/features/chests";
import { Equipped, isEquipped } from "./equipment";

export interface ItemGroup {
	readonly item: ItemId;
	/** Equipped copies and spare copies of the same item are separate groups (different buttons). */
	readonly equipped: boolean;
	/** Every copy in the group; actions use the first one. Never empty. */
	readonly uids: ReadonlyArray<string>;
}

/**
 * The items of one kind, grouped by item and equipped state.
 * Order: equipped first, then stronger bonus first, then by name so the order never jumps between updates.
 */
export function groupInventory(inventory: ReadonlyArray<OwnedItem>, equipped: Equipped, kind: ItemKind): ItemGroup[] {
	const byKey = new Map<string, { item: ItemId; equipped: boolean; uids: string[] }>();
	const order: string[] = [];
	for (const owned of inventory) {
		const def = ITEMS[owned.item];
		if (def === undefined || def.kind !== kind) {
			continue;
		}
		const on = isEquipped(equipped, owned.uid);
		const key = `${owned.item}|${on}`;
		let group = byKey.get(key);
		if (group === undefined) {
			group = { item: owned.item, equipped: on, uids: [] };
			byKey.set(key, group);
			order.push(key);
		}
		group.uids.push(owned.uid);
	}
	const groups: ItemGroup[] = [];
	for (const key of order) {
		const group = byKey.get(key);
		if (group !== undefined) {
			groups.push(group);
		}
	}
	groups.sort((a, b) => {
		if (a.equipped !== b.equipped) {
			return a.equipped;
		}
		const bonusA = ITEMS[a.item].bonus;
		const bonusB = ITEMS[b.item].bonus;
		if (bonusA !== bonusB) {
			return bonusA > bonusB;
		}
		return ITEMS[a.item].name < ITEMS[b.item].name;
	});
	return groups;
}

/** How many copies of a kind the player owns (the number on its tab). */
export function countOfKind(inventory: ReadonlyArray<OwnedItem>, kind: ItemKind): number {
	let count = 0;
	for (const owned of inventory) {
		if (ITEMS[owned.item]?.kind === kind) {
			count += 1;
		}
	}
	return count;
}
