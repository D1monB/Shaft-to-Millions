import { Assert, Test } from "@rbxts/lunit";
import { BOOSTER_IDS, isBoosterId } from "shared/config/boosters";
import { MONEY_PACK_LAYER_GROWTH, STORE_PRODUCTS } from "shared/config/store";
import { moneyPackAmount, needsRandomPolicy, productById, visibleProducts } from "./store";

class StoreTests {
	@Test
	public onlyCrystalPacksNeedTheRandomPolicy() {
		for (const product of STORE_PRODUCTS) {
			Assert.equal(needsRandomPolicy(product), product.grant.kind === "crystals");
		}
		Assert.true(STORE_PRODUCTS.some((product) => needsRandomPolicy(product)));
		Assert.true(STORE_PRODUCTS.some((product) => !needsRandomPolicy(product)));
	}

	@Test
	public visibleProductsHideUnpricedAndRestrictedOnes() {
		// Expectations come from the config, so filling in a real productId later does not break the test.
		const created = STORE_PRODUCTS.filter((product) => product.productId !== undefined);
		const allowed = visibleProducts(true);
		Assert.equal(allowed.size(), created.size());
		for (const product of allowed) {
			Assert.true(product.productId !== undefined);
		}

		const restricted = visibleProducts(false);
		Assert.equal(restricted.size(), created.filter((product) => !needsRandomPolicy(product)).size());
		for (const product of restricted) {
			Assert.true(product.productId !== undefined);
			Assert.false(needsRandomPolicy(product));
		}
	}

	@Test
	public productByIdIsUndefinedForUnknownAndBrokenIds() {
		for (const bad of [0, -1, 1.5, 123456789, 0 / 0, math.huge, -math.huge]) {
			Assert.true(productById(bad) === undefined);
		}
	}

	@Test
	public productByIdFindsEveryCreatedProduct() {
		for (const product of STORE_PRODUCTS) {
			if (product.productId !== undefined) {
				Assert.equal(productById(product.productId), product);
			}
		}
	}

	@Test
	public moneyPackGrowsPerLayer() {
		Assert.equal(moneyPackAmount(1000, 1), 1000);
		Assert.equal(moneyPackAmount(1000, 2), 1000 * MONEY_PACK_LAYER_GROWTH);
		Assert.equal(moneyPackAmount(1000, 3), 1000 * MONEY_PACK_LAYER_GROWTH * MONEY_PACK_LAYER_GROWTH);
	}

	@Test
	public moneyPackTreatsBrokenLayersAsLayerOne() {
		for (const bad of [0 / 0, -3, 0, 0.5, math.huge, -math.huge]) {
			Assert.equal(moneyPackAmount(1000, bad), 1000);
		}
	}

	@Test
	public moneyPackRoundsFractionalLayersDown() {
		Assert.equal(moneyPackAmount(1000, 2.9), moneyPackAmount(1000, 2));
	}

	@Test
	public moneyPackHugeLayerIsClampedAndFinite() {
		const capped = moneyPackAmount(1000, 20);
		Assert.equal(moneyPackAmount(1000, 21), capped);
		Assert.equal(moneyPackAmount(1000, 1e9), capped);
		Assert.true(capped > moneyPackAmount(1000, 19));
		Assert.true(capped < math.huge);
		Assert.true(capped === capped);
	}

	@Test
	public configIdsAreUniqueAndPricesPositive() {
		const seen = new Set<string>();
		const seenProductIds = new Set<number>();
		for (const product of STORE_PRODUCTS) {
			Assert.false(seen.has(product.id));
			seen.add(product.id);
			Assert.true(product.robuxPrice > 0);
			Assert.equal(product.robuxPrice, math.floor(product.robuxPrice));
			if (product.productId !== undefined) {
				// Two products sharing one dashboard id would grant the wrong thing.
				Assert.false(seenProductIds.has(product.productId));
				seenProductIds.add(product.productId);
			}
		}
	}

	@Test
	public configGrantsAreValid() {
		for (const product of STORE_PRODUCTS) {
			const grant = product.grant;
			if (grant.kind === "boost") {
				Assert.true(grant.seconds > 0);
				Assert.true(grant.boosters.size() > 0);
				for (const id of grant.boosters) {
					Assert.true(isBoosterId(id));
					Assert.true(BOOSTER_IDS.includes(id));
				}
			} else {
				Assert.true(grant.amount > 0);
				Assert.equal(grant.amount, math.floor(grant.amount));
			}
		}
	}
}

export = StoreTests;
