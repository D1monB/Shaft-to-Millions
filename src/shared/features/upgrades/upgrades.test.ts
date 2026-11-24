import { Assert, Test } from "@rbxts/lunit";
import { PICKAXES } from "shared/config/pickaxes";
import { isUpgradeTrack, maxLevel, nextLevelDef, tryBuyUpgrade } from "./upgrades";

class UpgradesTests {
	@Test
	public buysTheNextLevel() {
		const result = tryBuyUpgrade("pickaxe", 1000, 1, 1);
		Assert.true(result.ok);
		if (result.ok) {
			Assert.equal(result.level, 2);
			Assert.equal(result.price, PICKAXES[1].price);
			Assert.equal(result.money, 1000 - PICKAXES[1].price);
		}
	}

	@Test
	public exactMoneyIsEnough() {
		const result = tryBuyUpgrade("pickaxe", PICKAXES[1].price, 1, 1);
		Assert.true(result.ok);
		if (result.ok) {
			Assert.equal(result.money, 0);
		}
	}

	@Test
	public refusesWithoutMoney() {
		const result = tryBuyUpgrade("pickaxe", PICKAXES[1].price - 1, 1, 1);
		Assert.false(result.ok);
		if (!result.ok) {
			Assert.equal(result.reason, "not-enough-money");
		}
	}

	@Test
	public refusesAtMaxLevel() {
		const top = maxLevel("bag");
		const result = tryBuyUpgrade("bag", 1e12, top, top);
		Assert.false(result.ok);
		Assert.undefined(nextLevelDef("bag", top));
	}

	@Test
	public doubleClickBuysOnlyOnce() {
		// Both clicks were sent while the client still showed level 1.
		const first = tryBuyUpgrade("pickaxe", 1000, 1, 1);
		Assert.true(first.ok);
		const second = tryBuyUpgrade("pickaxe", first.ok ? first.money : 0, 2, 1);
		Assert.false(second.ok);
		if (!second.ok) {
			Assert.equal(second.reason, "stale-request");
		}
	}

	@Test
	public hostileMoneyNeverBuys() {
		Assert.false(tryBuyUpgrade("pickaxe", 0 / 0, 1, 1).ok);
		Assert.false(tryBuyUpgrade("pickaxe", -1e9, 1, 1).ok);
	}

	@Test
	public trackIdsAreChecked() {
		Assert.true(isUpgradeTrack("pickaxe"));
		Assert.true(isUpgradeTrack("bag"));
		Assert.false(isUpgradeTrack("rocket"));
		Assert.false(isUpgradeTrack(3));
	}
}

export = UpgradesTests;
