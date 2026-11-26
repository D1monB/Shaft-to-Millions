import { Assert, Test } from "@rbxts/lunit";
import { activeCount, pickRandom } from "./ore-generation";

function sequence(values: ReadonlyArray<number>): () => number {
	let index = 0;
	return () => {
		const value = values[index % values.size()];
		index += 1;
		return value;
	};
}

class OreGenerationTests {
	@Test
	public activeCountIsAShareOfThePoints() {
		Assert.equal(activeCount(10, 0.4), 4);
		Assert.equal(activeCount(3, 0.4), 1);
		Assert.equal(activeCount(1, 0.01), 1);
		Assert.equal(activeCount(5, 1), 5);
		Assert.equal(activeCount(5, 7), 5);
	}

	@Test
	public activeCountRejectsBadInput() {
		Assert.equal(activeCount(0, 0.4), 0);
		Assert.equal(activeCount(-3, 0.4), 0);
		Assert.equal(activeCount(0 / 0, 0.4), 0);
		Assert.equal(activeCount(math.huge, 0.4), 0);
		Assert.equal(activeCount(10, 0), 0);
		Assert.equal(activeCount(10, -1), 0);
		Assert.equal(activeCount(10, 0 / 0), 0);
	}

	@Test
	public picksDifferentItemsFromTheList() {
		const items = ["a", "b", "c", "d", "e"];
		const picked = pickRandom(items, 3, sequence([0.9, 0.1, 0.5]));
		Assert.equal(picked.size(), 3);
		const seen = new Set<string>();
		for (const item of picked) {
			Assert.true(items.includes(item));
			Assert.false(seen.has(item));
			seen.add(item);
		}
		// The input list is not changed.
		Assert.equal(items.join(""), "abcde");
	}

	@Test
	public neverPicksMoreThanThereAre() {
		Assert.equal(pickRandom(["a", "b"], 5, sequence([0.5])).size(), 2);
		Assert.equal(pickRandom([], 3, sequence([0.5])).size(), 0);
	}

	@Test
	public badCountsPickNothing() {
		const items = ["a", "b", "c"];
		Assert.equal(pickRandom(items, 0, sequence([0.5])).size(), 0);
		Assert.equal(pickRandom(items, -2, sequence([0.5])).size(), 0);
		Assert.equal(pickRandom(items, 0 / 0, sequence([0.5])).size(), 0);
		Assert.equal(pickRandom(items, math.huge, sequence([0.5])).size(), 3);
	}

	@Test
	public brokenGeneratorStaysInRange() {
		const items = ["a", "b", "c"];
		for (const bad of [0 / 0, -5, 1, 7, math.huge, -math.huge]) {
			const picked = pickRandom(items, 3, sequence([bad]));
			Assert.equal(picked.size(), 3);
			for (const item of picked) {
				Assert.true(items.includes(item));
			}
		}
	}
}

export = OreGenerationTests;
