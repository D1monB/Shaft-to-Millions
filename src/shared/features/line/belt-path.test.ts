import { Assert, Test } from "@rbxts/lunit";
import {
	BeltPiece,
	chainPoints,
	cornerPiece,
	nearestIndex,
	orderPieces,
	pathBetween,
	straightPiece,
} from "./belt-path";

const p = (x: number, z: number) => ({ x, y: 0, z });

const v = (x: number, z: number) => ({ x, y: 6.4, z });

/** A made-up straight run between two points on the X axis. */
const run = (from: number, to: number, z = 0): BeltPiece => ({ points: [p(from, z), p(to, z)] });

function assertNear(actual: { x: number; z: number }, x: number, z: number) {
	Assert.true(math.abs(actual.x - x) < 0.1 && math.abs(actual.z - z) < 0.1);
}

/** Three joined pieces measured on the map author's belt (Plot1), shuffled: [after, before, corner]. */
function realPieces(): BeltPiece[] {
	const before = straightPiece(v(120.427, 450.086), v(-0.866, 0.5), 14.55, 1);
	const corner = cornerPiece(v(109.689, 461.301), v(0.49996, 0.86605), v(-0.86605, 0.49996), 1);
	const after = straightPiece(v(113.006, 475.733), v(0.49996, 0.86605), 13.05, 1);
	Assert.true(before !== undefined && corner !== undefined && after !== undefined);
	return [after as BeltPiece, before as BeltPiece, corner as BeltPiece];
}

class BeltPathTests {
	@Test
	public realCornerMeetsItsNeighbours() {
		const [after, before, corner] = realPieces();
		const last = corner.points.size() - 1;
		assertNear(corner.points[0], before.points[1].x, before.points[1].z);
		assertNear(corner.points[last], after.points[0].x, after.points[0].z);
	}

	// Regression: ordering by the nearest centre walked from machine 1 against the belt and stopped partway.
	@Test
	public startingMidBeltStillCoversItFromTheHead() {
		const pieces = realPieces();
		Assert.deepEqual(orderPieces(pieces, v(113, 475.7), 8), [1, 2, 0]);
		const path = chainPoints(pieces, [1, 2, 0], 0.5);
		// 2 + 5 + 2 points, the two shared joints merged.
		Assert.equal(path.size(), 7);
		assertNear(path[0], 126.73, 446.45);
		assertNear(path[6], 116.27, 481.38);
	}

	@Test
	public reversedFlowSwapsTheEnds() {
		Assert.equal(straightPiece(p(0, 0), p(1, 0), 10, 1)?.points[0].x, -5);
		Assert.equal(straightPiece(p(0, 0), p(1, 0), 10, -1)?.points[0].x, 5);
		const corner = cornerPiece(p(0, 0), p(1, 0), p(0, 1), 1) as BeltPiece;
		const reverse = cornerPiece(p(0, 0), p(1, 0), p(0, 1), -1) as BeltPiece;
		const last = reverse.points[reverse.points.size() - 1];
		assertNear(last, corner.points[0].x, corner.points[0].z);
	}

	@Test
	public gapsAreBridgedAndOtherRunsLeftOut() {
		// Two pieces with a small gap, a run beside them and a far one.
		const pieces = [run(12, 20), run(0, 10), run(20, 0, 10), run(500, 510)];
		Assert.deepEqual(orderPieces(pieces, p(15, 0), 8), [1, 0]);
	}

	@Test
	public closedLoopListsEveryPieceOnce() {
		const loop: BeltPiece[] = [
			{ points: [p(0, 0), p(10, 0)] },
			{ points: [p(10, 0), p(10, 10)] },
			{ points: [p(10, 10), p(0, 0)] },
		];
		Assert.equal(orderPieces(loop, p(0, 0), 1).size(), 3);
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
		Assert.equal(orderPieces([], p(0, 0), 10).size(), 0);
		Assert.equal(orderPieces([run(0, 5)], p(0, 0), 0).size(), 0);
		Assert.equal(orderPieces([run(0, 5)], p(0, 0), 0 / 0).size(), 0);
		Assert.equal(orderPieces([run(0, 5)], p(0 / 0, 0), 8).size(), 0);
		// Broken or one-point pieces are never followed.
		const broken = [run(0, 5), run(0 / 0, 0 / 0), { points: [p(5, 0)] }, run(5, 10)];
		Assert.deepEqual(orderPieces(broken, p(0, 0), 2), [0, 3]);
		Assert.equal(straightPiece(p(0, 0), p(1, 0), 10, 0), undefined);
		Assert.equal(straightPiece(p(0, 0), p(1, 0), -3, 1), undefined);
		Assert.equal(straightPiece(p(0, 0), p(1, 0), math.huge, 1), undefined);
		Assert.equal(cornerPiece(p(0, 0), p(0 / 0, 0), p(0, 1), 1), undefined);
		Assert.equal(cornerPiece(p(0, 0), p(1, 0), p(0, 1), 2), undefined);
		const path = [p(0, 0), p(1, 0)];
		Assert.equal(pathBetween(path, -1, 1).size(), 0);
		Assert.equal(pathBetween(path, 0, 5).size(), 0);
		Assert.equal(pathBetween(path, 0.5, 1).size(), 0);
	}
}

export = BeltPathTests;
