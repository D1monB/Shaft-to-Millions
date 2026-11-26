import { Assert, Test } from "@rbxts/lunit";
import { treasureReward } from "./mining";
import { TREASURE_EXTRA_CRYSTALS, TREASURE_MIN_CRYSTALS, TREASURE_MONEY_MULTIPLIER } from "./tuning";

class TreasureTests {
	@Test
	public moneyFollowsTheOrePrice() {
		Assert.equal(treasureReward(10, 0).money, 10 * TREASURE_MONEY_MULTIPLIER);
	}

	@Test
	public crystalsStayInTheirRange() {
		Assert.equal(treasureReward(10, 0).crystals, TREASURE_MIN_CRYSTALS);
		Assert.equal(treasureReward(10, 0.9999).crystals, TREASURE_MIN_CRYSTALS + TREASURE_EXTRA_CRYSTALS);
	}

	@Test
	public badInputGivesTheSmallestReward() {
		for (const price of [0, -5, 0 / 0, math.huge]) {
			Assert.equal(treasureReward(price, 0.5).money, 0);
		}
		for (const roll of [-1, 0 / 0]) {
			Assert.equal(treasureReward(10, roll).crystals, TREASURE_MIN_CRYSTALS);
		}
		Assert.equal(treasureReward(10, math.huge).crystals, TREASURE_MIN_CRYSTALS + TREASURE_EXTRA_CRYSTALS);
	}
}

export = TreasureTests;
