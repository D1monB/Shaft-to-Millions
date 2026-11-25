import { Assert, Test } from "@rbxts/lunit";
import { nearestIndex, orderChain, pathBetween } from "./belt-path";

const p = (x: number, z: number) => ({ x, y: 0, z });

class BeltPathTests {
	@Test
	public ordersAShuffledLShapedBelt() {
		// An L: (0,0) (10,0) (20,0) then up to (20,10) (20,20), shuffled, plus a far decoration.
		const points = [p(20, 10), p(0, 0), p(20, 20), p(10, 0), p(500, 500), p(20, 0)];
		const chain = orderChain(points, p(-3, 0), 12);
		Assert.deepEqual(chain, [1, 3, 5, 0, 2]);
	}

	@Test
	public nearestFindsTheClosestOnTheGround() {
		const points = [p(0, 0), { x: 10, y: 50, z: 0 }, p(30, 0)];
		Assert.equal(nearestIndex(points, p(12, 0)), 1);
		Assert.equal(nearestIndex([], p(0, 0)), -1);
		Assert.equal(nearestIndex(points, { x: 0 / 0, y: 0, z: 0 }), -1);
	}

	@Test
	public pathBetweenGoesEitherWay() {
		const path = [p(0, 0), p(1, 0), p(2, 0), p(3, 0)];
		Assert.equal(pathBetween(path, 1, 3).size(), 3);
		Assert.equal(pathBetween(path, 3, 1)[0].x, 3);
		Assert.equal(pathBetween(path, 2, 2).size(), 1);
	}

	@Test
	public badInputGivesNothing() {
		Assert.equal(orderChain([], p(0, 0), 10).size(), 0);
		Assert.equal(orderChain([p(0, 0)], p(0, 0), 0).size(), 0);
		Assert.equal(orderChain([p(0, 0)], p(0, 0), 0 / 0).size(), 0);
		// Broken points are skipped, never followed.
		Assert.deepEqual(orderChain([p(0, 0), { x: 0 / 0, y: 0, z: 0 }, p(5, 0)], p(0, 0), 10), [0, 2]);
		const path = [p(0, 0), p(1, 0)];
		Assert.equal(pathBetween(path, -1, 1).size(), 0);
		Assert.equal(pathBetween(path, 0, 5).size(), 0);
		Assert.equal(pathBetween(path, 0.5, 1).size(), 0);
	}
}

export = BeltPathTests;
