import { Assert, Test } from "@rbxts/lunit";
import { parseBeltPath, routeFor, StoredBeltPath } from "./belt-path";

// A straight belt of 10 points: machine 1 at 2, machine 2 at 5, machine 3 unknown, SellStation at 9.
const PATH: StoredBeltPath = {
	points: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => ({ x, y: 0, z: 0 })),
	machines: [2, 5, -1],
	sell: 9,
};

class BeltRouteTests {
	@Test
	public rawOreGoesToTheFirstMachineOrToTheSellStation() {
		Assert.deepEqual(routeFor(PATH, -1, 0), { start: 0, target: 9, stage: 0 });
		Assert.deepEqual(routeFor(PATH, -1, 2), { start: 0, target: 2, stage: 0 });
	}

	@Test
	public machineOutputGoesToTheNextMachineThenToTheSellStation() {
		Assert.deepEqual(routeFor(PATH, 0, 2), { start: 2, target: 5, stage: 1 });
		Assert.deepEqual(routeFor(PATH, 1, 2), { start: 5, target: 9, stage: 2 });
	}

	@Test
	public unknownPlacesAndBadInputGiveNoRoute() {
		// Machine 3's place is unknown (-1): no ride into it, none out of it.
		Assert.equal(routeFor(PATH, 1, 3), undefined);
		Assert.equal(routeFor(PATH, 2, 3), undefined);
		// A machine the player does not own, or past the list.
		Assert.equal(routeFor(PATH, 2, 2), undefined);
		Assert.equal(routeFor(PATH, 7, 20), undefined);
		Assert.equal(routeFor(PATH, -2, 1), undefined);
		Assert.equal(routeFor(PATH, 0.5, 2), undefined);
		Assert.equal(routeFor(PATH, 0 / 0, 2), undefined);
		Assert.equal(routeFor(PATH, math.huge, 2), undefined);
		Assert.equal(routeFor(PATH, 0, 0 / 0), undefined);
		// No SellStation: raw ore has nowhere to go.
		Assert.equal(routeFor({ ...PATH, sell: -1 }, -1, 0), undefined);
	}

	@Test
	public parsesAGoodValue() {
		const parsed = parseBeltPath({ p: [0, 1, 2, 3, 4, 5], m: [0, -1], s: 1 });
		Assert.notUndefined(parsed);
		Assert.equal(parsed?.points.size(), 2);
		Assert.equal(parsed?.points[1].z, 5);
		Assert.deepEqual(parsed?.machines, [0, -1]);
		Assert.equal(parsed?.sell, 1);
		// A missing or out-of-range SellStation index only means "unknown".
		Assert.equal(parseBeltPath({ p: [0, 0, 0], m: [], s: 7 })?.sell, -1);
	}

	@Test
	public rejectsMalformedValues() {
		Assert.equal(parseBeltPath(undefined), undefined);
		Assert.equal(parseBeltPath("path"), undefined);
		Assert.equal(parseBeltPath({ m: [], s: 0 }), undefined);
		Assert.equal(parseBeltPath({ p: [], m: [], s: 0 }), undefined);
		Assert.equal(parseBeltPath({ p: [0, 0], m: [], s: 0 }), undefined);
		Assert.equal(parseBeltPath({ p: [0, "1", 0], m: [], s: 0 }), undefined);
		Assert.equal(parseBeltPath({ p: [0, 0 / 0, 0], m: [], s: 0 }), undefined);
		Assert.equal(parseBeltPath({ p: [0, math.huge, 0], m: [], s: 0 }), undefined);
		Assert.equal(parseBeltPath({ p: [0, 0, 0], m: [3], s: 0 }), undefined);
		Assert.equal(parseBeltPath({ p: [0, 0, 0], m: [0.5], s: 0 }), undefined);
		Assert.equal(parseBeltPath({ p: [0, 0, 0], m: "x", s: 0 }), undefined);
	}
}

export = BeltRouteTests;
