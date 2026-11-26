import { Assert, Test } from "@rbxts/lunit";
import { ORES, ORE_IDS } from "shared/config/ores";
import { MAX_SELL_MULTIPLIER, previewSale, safeMultiplier } from "./selling";

const PRICES = ORES as unknown as { [id: string]: { price: number } };

class SellingTests {
	@Test
	public sumsLinesInConfigOrder() {
		const preview = previewSale({ iron: 2, copper: 3 }, ORE_IDS, PRICES, 1);
		Assert.equal(preview.lines.size(), 2);
		Assert.equal(preview.lines[0].id, "copper");
		Assert.equal(preview.lines[0].subtotal, 3 * ORES.copper.price);
		Assert.equal(preview.baseTotal, 3 * ORES.copper.price + 2 * ORES.iron.price);
		Assert.equal(preview.itemCount, 5);
		Assert.equal(preview.total, preview.baseTotal);
	}

	@Test
	public emptyBagSellsForNothing() {
		const preview = previewSale({}, ORE_IDS, PRICES, 2);
		Assert.equal(preview.total, 0);
		Assert.equal(preview.lines.size(), 0);
	}

	@Test
	public multiplierAppliesAndRoundsDown() {
		// x1.25 of a base that is not a multiple of 4 has a fraction; rounding down never creates money from nothing.
		const prices = { copper: { price: 5 } };
		const preview = previewSale({ copper: 3 }, ["copper"], prices, 1.25);
		Assert.equal(preview.total, 18);
	}

	@Test
	public badCountsAreSkipped() {
		const preview = previewSale(
			{ copper: -5, iron: 0 / 0, gold: math.huge, titanium: 1.9, junk: 100 },
			ORE_IDS,
			PRICES,
			1,
		);
		Assert.equal(preview.lines.size(), 1);
		Assert.equal(preview.lines[0].count, 1);
		Assert.equal(preview.total, ORES.titanium.price);
	}

	@Test
	public multiplierIsClamped() {
		Assert.equal(safeMultiplier(0.5), 1);
		Assert.equal(safeMultiplier(-3), 1);
		Assert.equal(safeMultiplier(0 / 0), 1);
		Assert.equal(safeMultiplier(math.huge), MAX_SELL_MULTIPLIER);
		Assert.equal(safeMultiplier(1.5), 1.5);
	}
}

export = SellingTests;
