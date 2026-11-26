import { Assert, Test } from "@rbxts/lunit";
import { mayRide, rideProgress, rideSeconds } from "./lift";
import { LIFT_SPEED, MAX_RIDE_SECONDS, MIN_RIDE_SECONDS } from "./tuning";

class LiftTests {
	@Test
	public rideTimeFollowsTheDistance() {
		Assert.equal(rideSeconds(LIFT_SPEED * 5), 5);
		Assert.equal(rideSeconds(1), MIN_RIDE_SECONDS);
		Assert.equal(rideSeconds(LIFT_SPEED * 1000), MAX_RIDE_SECONDS);
	}

	@Test
	public badDistancesGiveTheShortestRide() {
		for (const bad of [0, -10, 0 / 0, math.huge, -math.huge]) {
			Assert.equal(rideSeconds(bad), MIN_RIDE_SECONDS);
		}
	}

	@Test
	public progressEasesFromZeroToOne() {
		Assert.equal(rideProgress(0, 4), 0);
		Assert.equal(rideProgress(2, 4), 0.5);
		Assert.equal(rideProgress(4, 4), 1);
		Assert.equal(rideProgress(9, 4), 1);
		Assert.equal(rideProgress(-1, 4), 0);
		Assert.true(rideProgress(1, 4) < 0.25);
	}

	@Test
	public badProgressInputFinishesTheRide() {
		Assert.equal(rideProgress(1, 0), 1);
		Assert.equal(rideProgress(1, -3), 1);
		Assert.equal(rideProgress(1, 0 / 0), 1);
		Assert.equal(rideProgress(0 / 0, 4), 1);
		Assert.equal(rideProgress(math.huge, 4), 1);
	}

	@Test
	public goingUpIsAlwaysAllowed() {
		Assert.true(mayRide(false, 5, 1));
		Assert.true(mayRide(false, undefined, 0));
	}

	@Test
	public goingDownNeedsTheBottomLayerOpened() {
		Assert.true(mayRide(true, 3, 3));
		Assert.true(mayRide(true, 2, 5));
		Assert.false(mayRide(true, 4, 3));
		Assert.true(mayRide(true, undefined, 1));
		Assert.false(mayRide(true, undefined, 0));
	}

	@Test
	public badBottomLayerCountsAsTheFirst() {
		Assert.true(mayRide(true, 0 / 0, 1));
		Assert.true(mayRide(true, math.huge, 1));
		Assert.false(mayRide(true, 9, 0 / 0));
	}
}

export = LiftTests;
