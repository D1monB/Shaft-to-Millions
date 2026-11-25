import { Assert, Test } from "@rbxts/lunit";
import { BAGS } from "shared/config/bags";
import { OreCounts, addToBag, bagCapacity, bagFreeSpace, bagTotal } from "./bag";

class BagTests {
	@Test
	public bagLevelsGrowAndStartFree() {
		Assert.equal(BAGS[0].price, 0);
		for (let i = 1; i < BAGS.size(); i++) {
			Assert.true(BAGS[i].capacity > BAGS[i - 1].capacity);
			Assert.true(BAGS[i].price > BAGS[i - 1].price);
		}
	}

	@Test
	public capacityOfABagId() {
		Assert.equal(bagCapacity(BAGS[0].id), BAGS[0].capacity);
		Assert.equal(bagCapacity(BAGS[3].id), BAGS[3].capacity);
		// Unknown ids (broken save, item from a newer server, an id of another slot) fall back to the starter.
		Assert.equal(bagCapacity(""), BAGS[0].capacity);
		Assert.equal(bagCapacity("pickaxe_wood"), BAGS[0].capacity);
	}

	@Test
	public addsUntilFull() {
		const bag: OreCounts = {};
		Assert.equal(addToBag(bag, "coal", 3, 5), 3);
		Assert.equal(addToBag(bag, "iron", 3, 5), 2);
		Assert.equal(addToBag(bag, "iron", 1, 5), 0);
		Assert.equal(bagTotal(bag), 5);
		Assert.equal(bagFreeSpace(bag, 5), 0);
	}

	@Test
	public rejectsBadAmounts() {
		const bag: OreCounts = {};
		Assert.equal(addToBag(bag, "coal", -3, 10), 0);
		Assert.equal(addToBag(bag, "coal", 0, 10), 0);
		Assert.equal(addToBag(bag, "coal", 0 / 0, 10), 0);
		Assert.equal(addToBag(bag, "coal", math.huge, 10), 0);
		Assert.equal(addToBag(bag, "coal", 2.9, 10), 2);
		Assert.equal(bagTotal(bag), 2);
	}

	@Test
	public unknownKeysDoNotCount() {
		const bag = { coal: 2, junk: 1000 } as unknown as OreCounts;
		Assert.equal(bagTotal(bag), 2);
	}

	@Test
	public smallerCapacityThanContentsMeansNoFreeSpace() {
		// Can happen if a capacity is lowered in a balance patch: no negative space, no crash.
		const bag: OreCounts = { coal: 30 };
		Assert.equal(bagFreeSpace(bag, 25), 0);
		Assert.equal(addToBag(bag, "coal", 1, 25), 0);
	}
}

export = BagTests;
