import { Assert, Test } from "@rbxts/lunit";
import { MAX_COUNTER } from "shared/lib/repair";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";

function load(mutate: (raw: PlainTable) => void) {
	const raw = createDefaultProfileData() as unknown as PlainTable;
	mutate(raw);
	return loadProfileData(raw);
}

// Regression tests for the 2026-11-24 security review.
class SanitizeResilienceTests {
	@Test
	public unknownKeysWithOddShapesDoNotLockThePlayerOut() {
		// Written by a newer server (e.g. a drill on layer 4, a new machine). Older servers must still load the save.
		const result = load((raw) => {
			raw.drills = { layer4: { oreId: "mythic", lastTick: "soon", progress: {}, buffer: 1.5 } };
			raw.machines = { smelter2: { queue: "x", startedAt: "y", ready: 5 } };
			raw.bag = { futureOre: "lots" };
			raw.warehouse = { futureProduct: true };
		});
		Assert.true(result.ok);
		if (result.ok) {
			// Unknown data is kept for the newer server, untouched.
			Assert.notUndefined((result.data.drills as PlainTable).layer4);
		}
	}

	@Test
	public uidsMustBeIPlusDigits() {
		const result = load((raw) => {
			raw.inventory = [
				{ uid: "i1e308", item: "pet_mole" },
				{ uid: "i-5", item: "pet_mole" },
				{ uid: "x7", item: "pet_mole" },
				{ uid: "i1234567890123", item: "pet_mole" },
				{ uid: "i7", item: "pet_mole" },
			];
		});
		Assert.true(result.ok);
		if (result.ok) {
			Assert.equal(result.data.inventory.size(), 1);
			Assert.equal(result.data.nextUid, 8);
		}
	}

	@Test
	public nextUidNeverExceedsTheCounterCap() {
		const result = load((raw) => {
			raw.inventory = [{ uid: "i999999999999", item: "pet_mole" }];
		});
		Assert.true(result.ok);
		if (result.ok) {
			Assert.true(result.data.nextUid <= MAX_COUNTER);
			Assert.true(result.data.nextUid > 999999999999);
		}
	}
}

export = SanitizeResilienceTests;
