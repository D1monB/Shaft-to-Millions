import { Assert, Test } from "@rbxts/lunit";
import { geodeReward } from "./mining";
import { GEODE_BOOST_CHANCE, GEODE_EXTRA_CRYSTALS, GEODE_MIN_CRYSTALS } from "./tuning";

// Geodes (decision 060).
class GeodeTests {
	@Test
	public crystalsStayInRange() {
		for (const roll of [0, 0.3, 0.7, 0.999999, 1, -1, 0 / 0, math.huge]) {
			const reward = geodeReward(roll, 0.99, 0, 3);
			Assert.true(reward.crystals >= GEODE_MIN_CRYSTALS, `roll ${roll}`);
			Assert.true(reward.crystals <= GEODE_MIN_CRYSTALS + GEODE_EXTRA_CRYSTALS, `roll ${roll}`);
		}
	}

	@Test
	public boosterOnlyOnALuckyRoll() {
		Assert.equal(geodeReward(0, 0.99, 0, 3).boosterIndex, undefined);
		Assert.equal(geodeReward(0, GEODE_BOOST_CHANCE, 0, 3).boosterIndex, undefined);
		const lucky = geodeReward(0, 0, 0.999, 3).boosterIndex;
		Assert.equal(lucky, 2);
	}

	@Test
	public badInputNeverGivesABooster() {
		for (const bad of [0 / 0, -1]) {
			Assert.equal(geodeReward(0, bad, 0, 3).boosterIndex, undefined, `boost roll ${bad}`);
		}
		for (const count of [0, -2, 0 / 0, math.huge]) {
			Assert.equal(geodeReward(0, 0, 0, count).boosterIndex, undefined, `count ${count}`);
		}
	}
}

export = GeodeTests;
