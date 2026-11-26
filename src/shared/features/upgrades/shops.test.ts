import { Assert, Test } from "@rbxts/lunit";
import { shopSells, shopSlotOf } from "./shops";
import { GEAR_SLOTS } from "./upgrades";

// Physical gear shops (decision 058).
class ShopsTests {
	@Test
	public aStandSellsOnlyItsSlot() {
		Assert.true(shopSells("pickaxe", "pickaxe"));
		Assert.false(shopSells("pickaxe", "bag"));
		Assert.false(shopSells("shoes", "pickaxe"));
		for (const slot of GEAR_SLOTS) {
			Assert.true(shopSells("all", slot), `all sells ${slot}`);
		}
	}

	@Test
	public brokenAttributesMeanAnAllInOneStand() {
		for (const slot of GEAR_SLOTS) {
			Assert.equal(shopSlotOf(slot), slot);
		}
		for (const junk of [undefined, "", "Pickaxe", "money", 5, true, {}]) {
			Assert.equal(shopSlotOf(junk), "all");
		}
	}
}

export = ShopsTests;
