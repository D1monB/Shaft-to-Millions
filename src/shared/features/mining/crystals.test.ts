import { Assert, Test } from "@rbxts/lunit";
import { ORES } from "shared/config/ores";
import { rollCrystals, veinYield } from "./mining";
import { RICH_YIELD_MULTIPLIER } from "./tuning";

class CrystalDropTests {
	@Test
	public dropsBelowTheChanceOnly() {
		Assert.equal(rollCrystals(0.05, 0), 1);
		Assert.equal(rollCrystals(0.05, 0.049), 1);
		Assert.equal(rollCrystals(0.05, 0.05), 0);
		Assert.equal(rollCrystals(0.05, 0.99), 0);
	}

	@Test
	public badInputGivesNothing() {
		for (const chance of [0, -1, 0 / 0]) {
			Assert.equal(rollCrystals(chance, 0), 0);
		}
		for (const roll of [-0.1, 0 / 0]) {
			Assert.equal(rollCrystals(0.5, roll), 0);
		}
		// A chance above 1 is capped: never more than one crystal per block.
		Assert.equal(rollCrystals(math.huge, 0.5), 1);
	}

	@Test
	public everyOreHasASmallChance() {
		for (const [, ore] of pairs(ORES)) {
			Assert.true(ore.crystalChance > 0 && ore.crystalChance <= 0.1);
		}
	}

	@Test
	public richVeinsMultiplyTheYield() {
		Assert.equal(veinYield(2, true), 2 * RICH_YIELD_MULTIPLIER);
		Assert.equal(veinYield(2, false), 2);
		Assert.equal(veinYield(0, true), 0);
		Assert.equal(veinYield(-1, true), -1);
		Assert.equal(veinYield(math.huge, true), math.huge);
		const nan = veinYield(0 / 0, true);
		Assert.true(nan !== nan);
	}
}

export = CrystalDropTests;
