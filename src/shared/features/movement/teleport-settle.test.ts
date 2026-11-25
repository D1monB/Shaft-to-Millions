import { Assert, Test } from "@rbxts/lunit";
import { beginSettle, settle } from "./teleport-settle";
import { TELEPORT_ARRIVAL_STUDS, TELEPORT_SETTLE_SECONDS } from "./tuning";

const FROM = { x: 0, y: 5, z: 0 };
const TARGET = { x: 100, y: 5, z: 200 };
const SPEED = 20;

function pending() {
	const result = beginSettle(FROM, TARGET, 10);
	if (result === undefined) {
		throw "beginSettle refused valid numbers";
	}
	return result;
}

class TeleportSettleTests {
	@Test
	public staleOldPositionWaits() {
		Assert.equal(settle(pending(), FROM, 10.1, SPEED), "wait");
		// Walking a little near the old spot while the client catches up is fine too.
		Assert.equal(settle(pending(), { x: 15, y: 5, z: 0 }, 10.5, SPEED), "wait");
	}

	@Test
	public nearTheTargetArrives() {
		Assert.equal(settle(pending(), TARGET, 10.1, SPEED), "arrived");
		Assert.equal(
			settle(pending(), { x: 100 + TELEPORT_ARRIVAL_STUDS - 0.5, y: 5, z: 200 }, 10.1, SPEED),
			"arrived",
		);
		// Arrival still counts after the wait.
		Assert.equal(settle(pending(), { x: 101, y: 6, z: 199 }, 10 + TELEPORT_SETTLE_SECONDS + 5, SPEED), "arrived");
	}

	@Test
	public neverArrivingTimesOut() {
		Assert.equal(settle(pending(), FROM, 10 + TELEPORT_SETTLE_SECONDS + 0.01, SPEED), "timeout");
	}

	@Test
	public jumpingElsewhereDuringTheWaitIsCaughtAtOnce() {
		// Regression (exploit review 2026-11-25): the wait was a free 2 s teleport to anywhere, e.g. the next camp.
		Assert.equal(settle(pending(), { x: 5000, y: 5, z: 5000 }, 10.1, SPEED), "timeout");
		Assert.equal(settle(pending(), { x: 0, y: -900, z: 0 }, 10.2, SPEED), "timeout");
	}

	@Test
	public brokenNumbersAreNotTrusted() {
		Assert.equal(settle(pending(), { x: 0 / 0, y: 5, z: 200 }, 10.1, SPEED), "timeout");
		Assert.equal(settle(pending(), { x: 100, y: math.huge, z: 200 }, 10.1, SPEED), "timeout");
		Assert.equal(settle(pending(), TARGET, 0 / 0, SPEED), "timeout");
		// A broken speed falls back to the cap, never to "unlimited".
		Assert.equal(settle(pending(), { x: 5000, y: 5, z: 5000 }, 10.1, math.huge), "timeout");
		Assert.undefined(beginSettle({ x: 0 / 0, y: 0, z: 0 }, TARGET, 1));
		Assert.undefined(beginSettle(FROM, TARGET, math.huge));
	}
}

export = TeleportSettleTests;
