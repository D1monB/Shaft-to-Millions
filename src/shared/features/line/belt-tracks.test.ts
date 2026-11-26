import { Assert, Test } from "@rbxts/lunit";
import { BELT_TRACKS, POLISH_LEVELS, SILO_LEVELS } from "shared/config/line";
import {
	beltTrackLevels,
	hopperCapacity,
	intakeRoom,
	itemValue,
	newLineState,
	nextBeltLevel,
	tryBeltUpgrade,
} from "./line";

// The three belt upgrades (decision 069).
class BeltTracksTests {
	@Test
	public everyTrackGrowsInPriceAndValue() {
		for (const track of BELT_TRACKS) {
			const levels = beltTrackLevels(track);
			Assert.equal(levels[0].price, 0);
			for (let i = 1; i < levels.size(); i++) {
				Assert.true(levels[i].price > levels[i - 1].price, `${track} price ${i}`);
				Assert.true(levels[i].value > levels[i - 1].value, `${track} value ${i}`);
			}
		}
	}

	@Test
	public siloHoldsMoreAndPolishPaysMore() {
		const state = newLineState();
		Assert.equal(intakeRoom(state), SILO_LEVELS[0].value);
		const before = itemValue(state, "copper", -1, () => 100) as number;
		state.siloLevel = 2;
		state.polishLevel = POLISH_LEVELS.size();
		Assert.equal(hopperCapacity(state), SILO_LEVELS[1].value);
		const after = itemValue(state, "copper", -1, () => 100) as number;
		Assert.true(after > before * 1.1);
	}

	@Test
	public brokenLevelsAndMoneyAreSafe() {
		const state = newLineState();
		for (const bad of [0, -4, 0 / 0, 999]) {
			state.siloLevel = bad;
			Assert.true(hopperCapacity(state) >= SILO_LEVELS[0].value, `level ${bad}`);
		}
		state.siloLevel = SILO_LEVELS.size();
		Assert.equal(nextBeltLevel(state, "capacity"), undefined);
		Assert.false(tryBeltUpgrade(state, math.huge, "capacity").ok);
		for (const money of [0 / 0, -1, 0]) {
			Assert.false(tryBeltUpgrade(newLineState(), money, "polish").ok, `money ${money}`);
		}
	}
}

export = BeltTracksTests;
