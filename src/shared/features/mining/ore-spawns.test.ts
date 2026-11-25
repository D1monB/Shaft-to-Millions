import { Assert, Test } from "@rbxts/lunit";
import { oreForSpawn, tierOf } from "./ore-spawns";
import { PORTAL_ORE_RADIUS } from "./tuning";

class OreSpawnsTests {
	@Test
	public eachTierGetsItsLayerOre() {
		Assert.equal(oreForSpawn(1, undefined), "copper");
		Assert.equal(oreForSpawn(2, undefined), "iron");
		Assert.equal(oreForSpawn(3, undefined), "silver");
		Assert.equal(oreForSpawn(4, undefined), "gold");
		Assert.equal(oreForSpawn(5, undefined), "titanium");
	}

	@Test
	public iridiumOnlyNearThePortalOnLayerFive() {
		Assert.equal(oreForSpawn(5, 10), "iridium");
		Assert.equal(oreForSpawn(5, PORTAL_ORE_RADIUS), "iridium");
		Assert.equal(oreForSpawn(5, PORTAL_ORE_RADIUS + 1), "titanium");
		// Other layers have no portal ore: a point near the portal keeps the layer's ore.
		Assert.equal(oreForSpawn(1, 5), "copper");
	}

	@Test
	public badInputGivesNoOreOrTheMainOre() {
		Assert.equal(oreForSpawn(0, undefined), undefined);
		Assert.equal(oreForSpawn(9, undefined), undefined);
		Assert.equal(oreForSpawn(0 / 0, undefined), undefined);
		Assert.equal(oreForSpawn(math.huge, undefined), undefined);
		Assert.equal(oreForSpawn(5, 0 / 0), "titanium");
		Assert.equal(oreForSpawn(5, -3), "titanium");
		Assert.equal(oreForSpawn(5, math.huge), "titanium");
	}

	@Test
	public readsTierFolderNames() {
		Assert.equal(tierOf("Tier1"), 1);
		Assert.equal(tierOf("Tier12"), 12);
		Assert.equal(tierOf("Tier0"), undefined);
		Assert.equal(tierOf("tier1"), undefined);
		Assert.equal(tierOf("Tier"), undefined);
		Assert.equal(tierOf("Tier1b"), undefined);
		Assert.equal(tierOf("Decor"), undefined);
	}
}

export = OreSpawnsTests;
