import { Assert, Test } from "@rbxts/lunit";
import { BAGS } from "shared/config/bags";
import { bagCapacity } from "./bag";

// The base's warehouse makes the bag bigger (decision 063).
class BagBonusTests {
	@Test
	public bonusEnlargesTheBag() {
		const first = BAGS[0];
		Assert.equal(bagCapacity(first.id), first.capacity);
		Assert.equal(bagCapacity(first.id, 0.4), math.floor(first.capacity * 1.4 + 0.000001));
	}

	@Test
	public brokenBonusIsClamped() {
		const first = BAGS[0];
		for (const bad of [0 / 0, -2, -math.huge]) {
			Assert.equal(bagCapacity(first.id, bad), first.capacity, `bonus ${bad}`);
		}
		Assert.equal(bagCapacity(first.id, math.huge), first.capacity * 2);
	}
}

export = BagBonusTests;
