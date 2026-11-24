import { Assert, Test } from "@rbxts/lunit";
import { PlainTable, deepCopy, fillMissing } from "./tables";

class TablesTests {
	@Test
	public deepCopyIsIndependent() {
		const original: PlainTable = { a: 1, nested: { b: 2 } };
		const copy = deepCopy(original);
		(copy.nested as PlainTable).b = 99;
		Assert.equal((original.nested as PlainTable).b, 2);
		Assert.deepEqual(copy.a, 1);
	}

	@Test
	public deepCopyKeepsArrays() {
		const copy = deepCopy({ items: ["x", "y"] });
		Assert.deepEqual(copy.items, ["x", "y"]);
	}

	@Test
	public deepCopyReturnsPrimitivesAsIs() {
		Assert.equal(deepCopy(5), 5);
		Assert.equal(deepCopy("text"), "text");
	}

	@Test
	public fillMissingAddsAbsentKeys() {
		const target: PlainTable = { a: 1 };
		fillMissing(target, { a: 5, b: 2 });
		Assert.equal(target.a, 1);
		Assert.equal(target.b, 2);
	}

	@Test
	public fillMissingRecursesIntoObjects() {
		const target: PlainTable = { stats: { mind: 3 } };
		fillMissing(target, { stats: { mind: 0, strength: 0 } });
		Assert.deepEqual(target.stats, { mind: 3, strength: 0 });
	}

	@Test
	public fillMissingKeepsUnknownKeys() {
		// A newer server version may have written keys we do not know about. They must survive.
		const target: PlainTable = { future: "value" };
		fillMissing(target, { a: 1 });
		Assert.equal(target.future, "value");
	}

	@Test
	public fillMissingCopiesDefaultsInsteadOfSharingThem() {
		const defaults: PlainTable = { stats: { mind: 0 } };
		const target: PlainTable = {};
		fillMissing(target, defaults);
		(target.stats as PlainTable).mind = 10;
		Assert.equal((defaults.stats as PlainTable).mind, 0);
	}

	@Test
	public fillMissingDoesNotTouchArrays() {
		const target: PlainTable = { items: ["a"] };
		fillMissing(target, { items: [] });
		Assert.deepEqual(target.items, ["a"]);
	}
}

export = TablesTests;
