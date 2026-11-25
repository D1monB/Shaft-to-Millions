import { Assert, Test } from "@rbxts/lunit";
import { BAGS } from "shared/config/bags";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
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
		Assert.equal(data.gear.equipped.pickaxe, PICKAXES[0].id);
		Assert.equal(data.gear.equipped.bag, BAGS[0].id);
		Assert.equal(data.gear.equipped.shoes, SHOES[0].id);
		Assert.deepEqual(data.bag, {});
	}

	@Test
	public equippedItemsMustBeOwnedAndOfTheirSlot() {
		const result = load((raw) => {
			raw.gear = {
				owned: [PICKAXES[0].id, BAGS[0].id, SHOES[0].id, BAGS[3].id],
				// Not owned / a pickaxe in the bag slot / a number.
				equipped: { pickaxe: PICKAXES[4].id, bag: PICKAXES[0].id, shoes: 5 },
			};
		});
		Assert.equal(result.data.gear.equipped.pickaxe, PICKAXES[0].id);
		Assert.equal(result.data.gear.equipped.bag, BAGS[0].id);
		Assert.equal(result.data.gear.equipped.shoes, SHOES[0].id);
	}

	@Test
	public ownedListIsCleanedAndAlwaysHasStarters() {
		const result = load((raw) => {
			raw.gear = { owned: [BAGS[2].id, BAGS[2].id, 7, "x".rep(100)], equipped: { bag: BAGS[2].id } };
		});
		const owned = result.data.gear.owned;
		Assert.equal(owned.filter((id) => id === BAGS[2].id).size(), 1);
		Assert.true(owned.includes(PICKAXES[0].id));
		Assert.true(owned.includes(SHOES[0].id));
		Assert.equal(owned.size(), 4);
		Assert.equal(result.data.gear.equipped.bag, BAGS[2].id);
	}

	@Test
	public unknownItemFromANewerServerIsKept() {
		const result = load((raw) => {
			raw.gear = {
				owned: [PICKAXES[0].id, BAGS[0].id, SHOES[0].id, "pickaxe_future"],
				equipped: { pickaxe: "pickaxe_future", bag: BAGS[0].id, shoes: SHOES[0].id },
			};
		});
		Assert.true(result.data.gear.owned.includes("pickaxe_future"));
		Assert.equal(result.data.gear.equipped.pickaxe, "pickaxe_future");
	}

	@Test
	public brokenGearTableIsReplaced() {
		for (const gear of ["max", 5]) {
			const result = load((raw) => {
				raw.gear = gear;
			});
			Assert.equal(result.data.gear.equipped.pickaxe, PICKAXES[0].id);
			Assert.equal(result.data.gear.owned.size(), 3);
		}
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
	public saveWithoutBagGearOrLevelsLoads() {
		const result = load((raw) => {
			raw.bag = undefined;
			raw.gear = undefined;
			raw.levels = undefined;
		});
		Assert.deepEqual(result.data.bag, {});
		Assert.equal(result.data.levels.warehouse, 1);
		Assert.equal(result.data.gear.equipped.shoes, SHOES[0].id);
	}
}

export = SanitizeGearAndBagTests;
