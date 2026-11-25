import { Assert, Test } from "@rbxts/lunit";
import { gapAround, splitStretch } from "./belt-gap";

function near(actual: number, expected: number, message?: string) {
	Assert.true(math.abs(actual - expected) < 1e-6, message ?? `${actual} != ${expected}`);
}

class BeltGapTests {
	@Test
	public findsTheGapBetweenTheNearestPieces() {
		const pieces = [
			{ from: -20, to: -12 },
			{ from: -12, to: -4 },
			{ from: 6, to: 14 },
			{ from: 14, to: 22 },
		];
		const gap = gapAround(0, pieces, 3, 50);
		Assert.notUndefined(gap);
		if (gap !== undefined) {
			near(gap.from, -4);
			near(gap.to, 6);
		}
	}

	@Test
	public reversedPieceEndsAreNormalised() {
		const gap = gapAround(0, [{ from: -4, to: -12 }, { from: 14, to: 6 }], 3, 50);
		Assert.notUndefined(gap);
		if (gap !== undefined) {
			near(gap.from, -4);
			near(gap.to, 6);
		}
	}

	@Test
	public missingSideFallsBackToTheMachineSize() {
		const gap = gapAround(0, [{ from: 5, to: 13 }], 3, 50);
		Assert.notUndefined(gap);
		if (gap !== undefined) {
			near(gap.from, -3);
			near(gap.to, 5);
		}
		// A piece beyond reach counts as missing.
		const far = gapAround(0, [{ from: 80, to: 88 }], 3, 50);
		Assert.notUndefined(far);
		if (far !== undefined) {
			near(far.to, 3);
		}
	}

	@Test
	public noGapWhenAPieceCoversTheCenter() {
		Assert.undefined(gapAround(0, [{ from: -4, to: 4 }], 3, 50));
	}

	@Test
	public badInputGivesNothing() {
		Assert.undefined(gapAround(0 / 0, [], 3, 50));
		Assert.undefined(gapAround(0, [], math.huge, 50));
		Assert.undefined(gapAround(0, [], -1, 50));
		Assert.undefined(gapAround(0, [], 0, 50));
		// Broken pieces are skipped, not trusted.
		const gap = gapAround(0, [{ from: 0 / 0, to: 1 }, { from: -math.huge, to: 2 }], 3, 50);
		Assert.notUndefined(gap);
		if (gap !== undefined) {
			near(gap.from, -3);
			near(gap.to, 3);
		}
	}

	@Test
	public splitsIntoWholePiecesAndATail() {
		const pieces = splitStretch(10, 4);
		Assert.equal(pieces.size(), 3);
		near(pieces[0], 4);
		near(pieces[1], 4);
		near(pieces[2], 2);
	}

	@Test
	public tinyTailFoldsIntoThePreviousPiece() {
		const pieces = splitStretch(8.2, 4);
		Assert.equal(pieces.size(), 2);
		near(pieces[0], 4);
		near(pieces[1], 4.2);
	}

	@Test
	public splitRejectsBadInputAndCapsPieces() {
		Assert.equal(splitStretch(0, 4).size(), 0);
		Assert.equal(splitStretch(10, 0).size(), 0);
		Assert.equal(splitStretch(0 / 0, 4).size(), 0);
		Assert.equal(splitStretch(math.huge, 4).size(), 0);
		Assert.equal(splitStretch(10_000, 1).size(), 32);
	}
}

export = BeltGapTests;
