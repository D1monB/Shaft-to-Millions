import { Assert, Test } from "@rbxts/lunit";
import { ItemId } from "shared/config/items";
import type { OwnedItem } from "shared/features/chests";
import { Equipped } from "./equipment";
import { countOfKind, groupInventory } from "./inventory-groups";

function owned(uid: string, item: ItemId): OwnedItem {
	return { uid, item };
}

const NONE: Equipped = { pets: [] };

class InventoryGroupsTests {
	@Test
	public copiesOfOneItemBecomeOneGroup() {
		const inventory = [owned("i1", "pet_mole"), owned("i2", "pet_mole"), owned("i3", "pet_mole")];
		const groups = groupInventory(inventory, NONE, "pet");
		Assert.equal(groups.size(), 1);
		Assert.equal(groups[0].uids.size(), 3);
		Assert.false(groups[0].equipped);
	}

	@Test
	public equippedAndSpareCopiesAreSeparate() {
		const inventory = [owned("i1", "pet_mole"), owned("i2", "pet_mole")];
		const groups = groupInventory(inventory, { pets: ["i2"] }, "pet");
		Assert.equal(groups.size(), 2);
		Assert.true(groups[0].equipped);
		Assert.equal(groups[0].uids[0], "i2");
		Assert.equal(groups[1].uids[0], "i1");
	}

	@Test
	public onlyTheRequestedKind() {
		const inventory = [owned("i1", "pet_mole"), owned("i2", "aura_breeze"), owned("i3", "paura_core")];
		Assert.equal(groupInventory(inventory, NONE, "pet").size(), 1);
		Assert.equal(groupInventory(inventory, NONE, "speedAura")[0].item, "aura_breeze");
		Assert.equal(groupInventory(inventory, NONE, "pickaxeAura")[0].item, "paura_core");
	}

	@Test
	public equippedFirstThenStrongest() {
		const inventory = [owned("i1", "pet_mole"), owned("i2", "pet_golem"), owned("i3", "pet_beetle")];
		const groups = groupInventory(inventory, { pets: ["i1"] }, "pet");
		Assert.equal(groups[0].item, "pet_mole");
		Assert.equal(groups[1].item, "pet_golem");
		Assert.equal(groups[2].item, "pet_beetle");
	}

	@Test
	public equippedAurasAreMarked() {
		const inventory = [owned("i1", "aura_spark"), owned("i2", "paura_glint")];
		const equipped: Equipped = { pets: [], speedAura: "i1", pickaxeAura: "i2" };
		Assert.true(groupInventory(inventory, equipped, "speedAura")[0].equipped);
		Assert.true(groupInventory(inventory, equipped, "pickaxeAura")[0].equipped);
	}

	@Test
	public emptyAndUnknownItemsAreSafe() {
		Assert.equal(groupInventory([], NONE, "pet").size(), 0);
		// A save from a newer server may hold an item this server does not know: it is skipped, not a crash.
		const unknown = [{ uid: "i9", item: "pet_from_the_future" as ItemId }];
		Assert.equal(groupInventory(unknown, NONE, "pet").size(), 0);
		Assert.equal(countOfKind(unknown, "pet"), 0);
	}

	@Test
	public countsCopiesPerKind() {
		const inventory = [owned("i1", "pet_mole"), owned("i2", "pet_mole"), owned("i3", "aura_breeze")];
		Assert.equal(countOfKind(inventory, "pet"), 2);
		Assert.equal(countOfKind(inventory, "speedAura"), 1);
		Assert.equal(countOfKind(inventory, "pickaxeAura"), 0);
	}

	@Test
	public orderIsStableForEqualBonuses() {
		const inventory = [owned("i1", "pet_beetle"), owned("i2", "pet_mole")];
		const first = groupInventory(inventory, NONE, "pet")
			.map((g) => g.item)
			.join(",");
		const reversed = [owned("i2", "pet_mole"), owned("i1", "pet_beetle")];
		const second = groupInventory(reversed, NONE, "pet")
			.map((g) => g.item)
			.join(",");
		Assert.equal(first, second);
	}
}

export = InventoryGroupsTests;
