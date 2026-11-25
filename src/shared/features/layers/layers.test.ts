import { Assert, Test } from "@rbxts/lunit";
import { LAYER_COUNT, oresOfLayer } from "shared/config/layers";
import { MIN_SECONDS_BETWEEN_UNLOCKS, isLayerOpen, reachLayer, unlockCooldownLeft } from "./layers";

class LayersTests {
	@Test
	public everyLayerHasOre() {
		for (let layer = 1; layer <= LAYER_COUNT; layer++) {
			Assert.true(oresOfLayer(layer).size() > 0, `layer ${layer} has no ore`);
		}
	}

	@Test
	public opensTheNextLayer() {
		Assert.equal(reachLayer(1, 2), 2);
		Assert.equal(reachLayer(2, 3), 3);
	}

	@Test
	public revisitingChangesNothing() {
		Assert.undefined(reachLayer(2, 1));
		Assert.undefined(reachLayer(2, 2));
	}

	@Test
	public cannotSkipALayer() {
		Assert.undefined(reachLayer(1, 3));
	}

	@Test
	public rejectsNonsense() {
		Assert.undefined(reachLayer(LAYER_COUNT, LAYER_COUNT + 1));
		Assert.undefined(reachLayer(1, 0 / 0));
		Assert.undefined(reachLayer(1, 1.5));
		Assert.undefined(reachLayer(0, 0));
	}

	// ---- anti-teleport (security review 2026-11-24) ----

	@Test
	public unlocksNeedTimeBetweenThem() {
		Assert.equal(unlockCooldownLeft(100, 100), MIN_SECONDS_BETWEEN_UNLOCKS);
		Assert.equal(unlockCooldownLeft(100 + MIN_SECONDS_BETWEEN_UNLOCKS, 100), 0);
		Assert.equal(unlockCooldownLeft(1000, 100), 0);
	}

	@Test
	public badClocksDoNotSkipTheCooldown() {
		Assert.equal(unlockCooldownLeft(50, 100), MIN_SECONDS_BETWEEN_UNLOCKS);
		Assert.equal(unlockCooldownLeft(0 / 0, 100), MIN_SECONDS_BETWEEN_UNLOCKS);
	}

	@Test
	public oreOnlyOnOpenedLayers() {
		Assert.true(isLayerOpen(1, 1));
		Assert.false(isLayerOpen(2, 1));
		Assert.true(isLayerOpen(2, 3));
		Assert.false(isLayerOpen(0, 3));
	}
}

export = LayersTests;
