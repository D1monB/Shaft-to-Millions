import { Assert, Test } from "@rbxts/lunit";
import { treasureReward } from "./mining";
import { TREASURE_LIFETIME_SHARE, TREASURE_MONEY_MULTIPLIER } from "./tuning";

// Decision 067: treasures stay worth something for old players.
class TreasureLifetimeTests {
	@Test
	public richPlayersGetAShareOfWhatTheyEarned() {
		Assert.equal(treasureReward(10, 0, 0).money, 10 * TREASURE_MONEY_MULTIPLIER);
		const rich = treasureReward(10, 0, 10_000_000).money;
		Assert.equal(rich, math.floor(10 * TREASURE_MONEY_MULTIPLIER + 10_000_000 * TREASURE_LIFETIME_SHARE));
	}

	@Test
	public brokenEarningsCountAsZero() {
		for (const bad of [0 / 0, -5, math.huge, -math.huge]) {
			Assert.equal(treasureReward(10, 0, bad).money, 10 * TREASURE_MONEY_MULTIPLIER, `earned ${bad}`);
		}
	}
}

export = TreasureLifetimeTests;
