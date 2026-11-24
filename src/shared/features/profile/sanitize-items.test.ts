import { Assert, Test } from "@rbxts/lunit";
import { INVENTORY_HARD_LIMIT } from "shared/config/items";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";
import { toPlayerView } from "./view";

function load(mutate: (raw: PlainTable) => void) {
	const raw = createDefaultProfileData() as unknown as PlainTable;
	mutate(raw);
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`load failed: ${result.reason}`);
	}
	return result;
}

class SanitizeItemsTests {
	@Test
	public keepsValidItems() {
		const result = load((raw) => {
			raw.inventory = [
				{ uid: "i1", item: "pet_mole" },
				{ uid: "i2", item: "aura_storm" },
			];
			raw.nextUid = 3;
		});
		Assert.equal(result.data.inventory.size(), 2);
		Assert.equal(result.repairs.size(), 0);
	}

	@Test
	public dropsUnknownItemsAndDuplicateUids() {
		// A duplicated uid would let one pet be equipped twice.
		const result = load((raw) => {
			raw.inventory = [
				{ uid: "i1", item: "pet_mole" },
				{ uid: "i1", item: "pet_golem" },
				{ uid: "i2", item: "free_robux" },
				"junk",
				{ uid: 5, item: "pet_mole" },
			];
		});
		Assert.equal(result.data.inventory.size(), 1);
		Assert.equal(result.data.inventory[0].item, "pet_mole");
	}

	@Test
	public nextUidMovesPastUidsInUse() {
		const result = load((raw) => {
			raw.inventory = [{ uid: "i40", item: "pet_mole" }];
			raw.nextUid = 2;
		});
		Assert.equal(result.data.nextUid, 41);
	}

	@Test
	public inventoryIsHardCapped() {
		const result = load((raw) => {
			const items: PlainTable[] = [];
			for (let i = 1; i <= INVENTORY_HARD_LIMIT + 30; i++) {
				items.push({ uid: `i${i}`, item: "pet_mole" });
			}
			raw.inventory = items;
		});
		Assert.equal(result.data.inventory.size(), INVENTORY_HARD_LIMIT);
	}

	@Test
	public brokenListsBecomeEmpty() {
		const result = load((raw) => {
			raw.inventory = "lots";
			raw.purchaseIds = 7;
		});
		Assert.equal(result.data.inventory.size(), 0);
		Assert.equal(result.data.purchaseIds.size(), 0);
	}

	@Test
	public receiptsAreNeverSentToTheClient() {
		const result = load((raw) => {
			raw.purchaseIds = ["receipt-1"];
		});
		Assert.equal(result.data.purchaseIds.size(), 1);
		Assert.undefined((toPlayerView(result.data) as unknown as PlainTable).purchaseIds);
	}
}

export = SanitizeItemsTests;
