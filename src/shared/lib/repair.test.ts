import { Assert, Test } from "@rbxts/lunit";
import { MAX_COUNTER, repairCountMap, repairInteger, repairNumber } from "./repair";
import { PlainTable } from "./tables";

class RepairTests {
	@Test
	public integerIsClampedFlooredAndLogged() {
		const target: PlainTable = { a: 7.9, b: -4, c: "x", d: 5 };
		const repairs: string[] = [];
		repairInteger(target, "a", 0, 10, 0, "a", repairs);
		repairInteger(target, "b", 0, 10, 0, "b", repairs);
		repairInteger(target, "c", 0, 10, 3, "c", repairs);
		repairInteger(target, "d", 0, 10, 0, "d", repairs);
		Assert.equal(target.a, 7);
		Assert.equal(target.b, 0);
		Assert.equal(target.c, 3);
		Assert.equal(target.d, 5);
		// Only changed values are reported.
		Assert.equal(repairs.size(), 3);
	}

	@Test
	public numberKeepsFractionsButNotNaN() {
		const target: PlainTable = { a: 1.5, b: 0 / 0 };
		const repairs: string[] = [];
		repairNumber(target, "a", 0, 10, 0, "a", repairs);
		repairNumber(target, "b", 0, 10, 2, "b", repairs);
		Assert.equal(target.a, 1.5);
		Assert.equal(target.b, 2);
	}

	@Test
	public countMapRepairsKnownIdsAndKeepsUnknownOnes() {
		const target: PlainTable = { bag: { coal: -3, iron: math.huge, futureOre: 9 } };
		const repairs: string[] = [];
		repairCountMap(target, "bag", ["coal", "iron", "copper"], "bag", repairs);
		const bag = target.bag as PlainTable;
		Assert.equal(bag.coal, 0);
		Assert.equal(bag.iron, MAX_COUNTER);
		Assert.undefined(bag.copper);
		Assert.equal(bag.futureOre, 9);
	}

	@Test
	public countMapReplacesANonTable() {
		const target: PlainTable = { bag: 5 };
		const repairs: string[] = [];
		repairCountMap(target, "bag", ["coal"], "bag", repairs);
		Assert.true(typeIs(target.bag, "table"));
		Assert.equal(repairs.size(), 1);
	}
}

export = RepairTests;
