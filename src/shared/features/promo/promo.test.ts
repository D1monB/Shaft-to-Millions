import { Assert, Test } from "@rbxts/lunit";
import { CODE_MAX_MONEY, hasUsesLeft, newPromoRecord, normalizeCode, readPromoRecord } from "./promo";

class PromoTests {
	@Test
	public codesAreNormalizedAndJunkRefused() {
		Assert.equal(normalizeCode("  start2026 "), "START2026");
		Assert.equal(normalizeCode("New_Year-1"), "NEW_YEAR-1");
		const bad: unknown[] = ["", "abc", "a b c d", "код1234", "x".rep(25), "x".rep(500), 12345, undefined, {}];
		for (const input of bad) {
			Assert.equal(normalizeCode(input), undefined);
		}
	}

	@Test
	public numbersOutOfRangeMakeNoCode() {
		Assert.notEqual(newPromoRecord(100, 0, 1), undefined);
		for (const [money, crystals, uses] of [
			[0, 0, 1],
			[-1, 5, 1],
			[CODE_MAX_MONEY + 1, 0, 1],
			[1.5, 0, 1],
			[0 / 0, 0, 1],
			[100, 0, 0],
			[100, math.huge, 1],
		]) {
			Assert.equal(newPromoRecord(money, crystals, uses), undefined, `${money} ${crystals} ${uses}`);
		}
	}

	@Test
	public brokenStoredValuesAreNoCode() {
		for (const junk of [undefined, 5, "x", {}, { money: 100, crystals: 0, maxUses: 5, uses: -1 }]) {
			Assert.equal(readPromoRecord(junk), undefined);
		}
		const record = readPromoRecord({ money: 100, crystals: 2, maxUses: 2, uses: 1 });
		Assert.notEqual(record, undefined);
		if (record !== undefined) {
			Assert.true(hasUsesLeft(record));
			record.uses = 2;
			Assert.false(hasUsesLeft(record));
		}
	}
}

export = PromoTests;
