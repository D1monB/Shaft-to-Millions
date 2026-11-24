import { Assert, Test } from "@rbxts/lunit";
import { BAGS } from "shared/config/bags";
import { PICKAXES } from "shared/config/pickaxes";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";

function load(mutate: (raw: PlainTable) => void) {
	const raw = createDefaultProfileData() as unknown as PlainTable;
	mutate(raw);
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`load failed: ${result.reason}`);
	}
	return result;
}

// One test class per feature's slice of the save, so each feature's bad-data cases stay together.
class SanitizeGearAndBagTests {
	@Test
	public newPlayerHasStarterGearAndEmptyBag() {
		const data = createDefaultProfileData();
		Assert.equal(data.levels.pickaxe, 1);
		Assert.equal(data.levels.bag, 1);
		Assert.deepEqual(data.bag, {});
	}

	@Test
	public levelsAreClampedToTheConfig() {
		const result = load((raw) => {
			raw.levels = { pickaxe: 999, bag: -4 };
		});
		Assert.equal(result.data.levels.pickaxe, PICKAXES.size());
		Assert.equal(result.data.levels.bag, 1);
		Assert.equal(BAGS.size() >= 1, true);
	}

	@Test
	public brokenLevelsTableIsReplaced() {
		const result = load((raw) => {
			raw.levels = "max";
		});
		Assert.equal(result.data.levels.pickaxe, 1);
	}

	@Test
	public bagCountsAreRepaired() {
		const result = load((raw) => {
			raw.bag = { coal: -5, iron: 2.5, copper: 0 / 0 };
		});
		Assert.equal(result.data.bag.coal, 0);
		Assert.equal(result.data.bag.iron, 2);
		Assert.equal(result.data.bag.copper, 0);
	}

	@Test
	public saveFromBeforeTheBagExistedLoads() {
		const result = load((raw) => {
			raw.bag = undefined;
			raw.levels = undefined;
		});
		Assert.deepEqual(result.data.bag, {});
		Assert.equal(result.data.levels.bag, 1);
	}
}

export = SanitizeGearAndBagTests;
