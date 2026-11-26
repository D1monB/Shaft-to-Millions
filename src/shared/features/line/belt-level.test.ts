import { Assert, Test } from "@rbxts/lunit";
import { BELT_LEVELS, BELT_SECONDS_PER_ITEM } from "shared/config/line";
import { advanceLine, beltSpeed, newLineState, nextBeltLevel, tryBeltUpgrade } from "./line";

const valueOf = () => 10;
const never = () => 0.99;

// The conveyor (decision 054): one level for the whole line.
class BeltLevelTests {
	@Test
	public levelsGetFasterAndCostMore() {
		Assert.equal(BELT_LEVELS[0].price, 0);
		Assert.equal(BELT_LEVELS[0].speed, 1);
		for (let i = 1; i < BELT_LEVELS.size(); i++) {
			Assert.true(BELT_LEVELS[i].speed > BELT_LEVELS[i - 1].speed, `speed of level ${i + 1}`);
			Assert.true(BELT_LEVELS[i].price > BELT_LEVELS[i - 1].price, `price of level ${i + 1}`);
		}
	}

	@Test
	public speedClampsBrokenLevels() {
		Assert.equal(beltSpeed(1), 1);
		Assert.equal(beltSpeed(2), BELT_LEVELS[1].speed);
		for (const bad of [0, -3, 0 / 0, -math.huge]) {
			Assert.equal(beltSpeed(bad), 1, `level ${bad}`);
		}
		Assert.equal(beltSpeed(999), BELT_LEVELS[BELT_LEVELS.size() - 1].speed);
		Assert.equal(beltSpeed(math.huge), 1);
	}

	@Test
	public buyingNeedsMoneyAndStopsAtTheTop() {
		const state = newLineState();
		const second = BELT_LEVELS[1];
		Assert.equal(tryBeltUpgrade(state, second.price - 1).ok, false);
		const bought = tryBeltUpgrade(state, second.price);
		Assert.true(bought.ok);
		if (bought.ok) {
			Assert.equal(bought.level, 2);
			Assert.equal(bought.money, 0);
		}
		state.beltLevel = BELT_LEVELS.size();
		Assert.equal(nextBeltLevel(state), undefined);
		const maxed = tryBeltUpgrade(state, math.huge);
		Assert.false(maxed.ok);
		if (!maxed.ok) {
			Assert.equal(maxed.reason, "maxed");
		}
	}

	@Test
	public hostileMoneyNeverBuys() {
		for (const bad of [0 / 0, -1, -math.huge]) {
			Assert.false(tryBeltUpgrade(newLineState(), bad).ok, `money ${bad}`);
		}
	}

	@Test
	public aFasterConveyorSellsMoreInTheSameTime() {
		const slow = newLineState();
		const fast = newLineState();
		fast.beltLevel = BELT_LEVELS.size();
		for (let i = 0; i < 40; i++) {
			slow.intake.push("copper");
			fast.intake.push("copper");
		}
		const seconds = BELT_SECONDS_PER_ITEM * 4;
		const a = advanceLine(slow, seconds, valueOf, never);
		const b = advanceLine(fast, seconds, valueOf, never);
		Assert.equal(a.sold, 4);
		Assert.equal(b.sold, math.floor(4 * BELT_LEVELS[BELT_LEVELS.size() - 1].speed));
	}
}

export = BeltLevelTests;
