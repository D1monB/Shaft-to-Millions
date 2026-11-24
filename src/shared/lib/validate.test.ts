import { Assert, Test } from "@rbxts/lunit";
import { isFiniteNumber, isIntegerInRange, isKeyOf, isShortString } from "./validate";

const RECORD = { coal: 1, iron: 2 };

class ValidateTests {
	@Test
	public finiteNumberRejectsSpecialValues() {
		Assert.true(isFiniteNumber(0));
		Assert.true(isFiniteNumber(-3.5));
		Assert.false(isFiniteNumber(0 / 0));
		Assert.false(isFiniteNumber(math.huge));
		Assert.false(isFiniteNumber(-math.huge));
		Assert.false(isFiniteNumber("5"));
		Assert.false(isFiniteNumber(undefined));
	}

	@Test
	public integerInRangeChecksBothEndsAndFractions() {
		Assert.true(isIntegerInRange(1, 1, 10));
		Assert.true(isIntegerInRange(10, 1, 10));
		Assert.false(isIntegerInRange(0, 1, 10));
		Assert.false(isIntegerInRange(11, 1, 10));
		Assert.false(isIntegerInRange(2.5, 1, 10));
		Assert.false(isIntegerInRange(0 / 0, 1, 10));
	}

	@Test
	public keyOfAcceptsOnlyRealKeys() {
		Assert.true(isKeyOf(RECORD, "coal"));
		Assert.false(isKeyOf(RECORD, "gold"));
		Assert.false(isKeyOf(RECORD, 1));
		Assert.false(isKeyOf(RECORD, undefined));
	}

	@Test
	public shortStringCapsLength() {
		Assert.true(isShortString("abc"));
		Assert.false(isShortString(""));
		Assert.false(isShortString(string.rep("x", 65)));
		Assert.false(isShortString(42));
	}
}

export = ValidateTests;
