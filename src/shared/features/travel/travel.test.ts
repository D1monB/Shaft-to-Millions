import { Assert, Test } from "@rbxts/lunit";
import { LAYER_COUNT } from "shared/config/layers";
import { HOME, SURFACE, canTravelTo, isTravelDestination, travelCooldownLeft, travelDestinations } from "./travel";
import { TRAVEL_COOLDOWN } from "./tuning";

class TravelTests {
	@Test
	public acceptsOnlyWholeNumbersInRange() {
		Assert.true(isTravelDestination(SURFACE));
		Assert.true(isTravelDestination(LAYER_COUNT));
		Assert.true(isTravelDestination(HOME));
		Assert.false(isTravelDestination(HOME - 1));
		Assert.false(isTravelDestination(LAYER_COUNT + 1));
		Assert.false(isTravelDestination(1.5));
		Assert.false(isTravelDestination(0 / 0));
		Assert.false(isTravelDestination(math.huge));
		Assert.false(isTravelDestination("1"));
		Assert.false(isTravelDestination(undefined));
		Assert.false(isTravelDestination({}));
	}

	@Test
	public surfaceAndBaseAreAlwaysAllowed() {
		Assert.true(canTravelTo(HOME, 0));
		Assert.true(canTravelTo(HOME, 0 / 0));
		Assert.true(canTravelTo(SURFACE, 0));
		Assert.true(canTravelTo(SURFACE, 3));
	}

	@Test
	public campNeedsToBeOpened() {
		Assert.false(canTravelTo(1, 0));
		Assert.true(canTravelTo(1, 1));
		Assert.false(canTravelTo(2, 1));
		Assert.true(canTravelTo(2, 2));
		Assert.true(canTravelTo(1, 2));
	}

	@Test
	public cannotTravelBelowTheLastLayer() {
		Assert.false(canTravelTo(LAYER_COUNT + 1, 999));
		Assert.true(canTravelTo(LAYER_COUNT, 999));
	}

	@Test
	public brokenSaveDepthNeverOpensCamps() {
		for (const bad of [0 / 0, -5, -math.huge]) {
			Assert.false(canTravelTo(1, bad));
			Assert.true(canTravelTo(SURFACE, bad));
		}
		// Infinity is clamped to the real number of layers instead of opening something that does not exist.
		Assert.false(canTravelTo(LAYER_COUNT + 1, math.huge));
	}

	@Test
	public destinationsListMatchesWhatIsAllowed() {
		for (let deepest = 0; deepest <= LAYER_COUNT; deepest++) {
			const list = travelDestinations(deepest);
			Assert.equal(list.size(), deepest + 2);
			Assert.equal(list[0], HOME);
			Assert.equal(list[1], SURFACE);
			for (const destination of list) {
				Assert.true(canTravelTo(destination, deepest));
			}
		}
		Assert.equal(travelDestinations(0 / 0).size(), 2);
		Assert.equal(travelDestinations(999).size(), LAYER_COUNT + 2);
	}

	@Test
	public firstTravelIsFree() {
		Assert.equal(travelCooldownLeft(100, undefined), 0);
	}

	@Test
	public cooldownCountsDownAndEnds() {
		Assert.equal(travelCooldownLeft(100, 100), TRAVEL_COOLDOWN);
		Assert.equal(travelCooldownLeft(110, 100), TRAVEL_COOLDOWN - 10);
		Assert.equal(travelCooldownLeft(100 + TRAVEL_COOLDOWN, 100), 0);
		Assert.equal(travelCooldownLeft(100 + TRAVEL_COOLDOWN + 500, 100), 0);
	}

	@Test
	public brokenClocksGiveTheFullPause() {
		Assert.equal(travelCooldownLeft(0 / 0, 100), TRAVEL_COOLDOWN);
		Assert.equal(travelCooldownLeft(100, 0 / 0), TRAVEL_COOLDOWN);
		// The clock went backwards: no free trip.
		Assert.equal(travelCooldownLeft(50, 100), TRAVEL_COOLDOWN);
	}
}

export = TravelTests;
