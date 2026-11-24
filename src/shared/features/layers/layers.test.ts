import { Assert, Test } from "@rbxts/lunit";
import { LAYERS, LAYER_COUNT, oresOfLayer } from "shared/config/layers";
import { reachLayer } from "./layers";

class LayersTests {
	@Test
	public everyLayerHasANameAndOre() {
		for (let layer = 1; layer <= LAYER_COUNT; layer++) {
			Assert.notUndefined(LAYERS[layer]);
			Assert.true(oresOfLayer(layer).size() > 0, `layer ${layer} has no ore`);
		}
		Assert.equal(LAYERS[1]?.name, "Сірі Пласти");
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
}

export = LayersTests;
