import { Assert, Test } from "@rbxts/lunit";
import { beginSettle, settle } from "./teleport-settle";
import { TELEPORT_ARRIVAL_STUDS, TELEPORT_SETTLE_SECONDS } from "./tuning";

function pending() {
	const result = beginSettle(100, 5, 200, 10);
	if (result === undefined) {
		throw "beginSettle refused valid numbers";
	}
	return result;
}

class TeleportSettleTests {
	@Test
	public staleOldPositionWaits() {
		Assert.equal(settle(pending(), 0, 5, 0, 10.1), "wait");
	}

	@Test
	public nearTheTargetArrives() {
		Assert.equal(settle(pending(), 100, 5, 200, 10.1), "arrived");
		Assert.equal(settle(pending(), 100 + TELEPORT_ARRIVAL_STUDS - 0.5, 5, 200, 10.1), "arrived");
	}

	@Test
	public neverArrivingTimesOut() {
		Assert.equal(settle(pending(), 0, 5, 0, 10 + TELEPORT_SETTLE_SECONDS + 0.01), "timeout");
		// Somewhere else entirely (a cheater using the wait) is also put back once it runs out.
		Assert.equal(settle(pending(), 5000, 5, 5000, 10 + TELEPORT_SETTLE_SECONDS), "timeout");
	}

	@Test
	public arrivalStillCountsAfterTheWait() {
		Assert.equal(settle(pending(), 101, 6, 199, 10 + TELEPORT_SETTLE_SECONDS + 5), "arrived");
	}

	@Test
	public brokenNumbersAreNotTrusted() {
		Assert.equal(settle(pending(), 0 / 0, 5, 200, 10.1), "timeout");
		Assert.equal(settle(pending(), 100, math.huge, 200, 10.1), "timeout");
		Assert.equal(settle(pending(), 100, 5, 200, 0 / 0), "timeout");
		Assert.undefined(beginSettle(0 / 0, 0, 0, 1));
		Assert.undefined(beginSettle(0, 0, 0, math.huge));
	}
}

export = TeleportSettleTests;
