import { Assert, Test } from "@rbxts/lunit";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";

function loadCrystals(value: unknown): number {
	const raw = createDefaultProfileData() as unknown as PlainTable;
	raw.crystals = value as never;
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`load failed: ${result.reason}`);
		return -1;
	}
	return result.data.crystals;
}

class SanitizeCrystalsTests {
	@Test
	public newPlayerHasNoCrystals() {
		Assert.equal(createDefaultProfileData().crystals, 0);
	}

	@Test
	public anOldSaveWithoutCrystalsGetsZero() {
		Assert.equal(loadCrystals(undefined), 0);
	}

	@Test
	public crystalsAreKept() {
		Assert.equal(loadCrystals(42), 42);
	}

	@Test
	public badCrystalsAreRepaired() {
		for (const bad of [-5, 0 / 0, "lots", true, {}]) {
			Assert.equal(loadCrystals(bad), 0);
		}
		Assert.true(loadCrystals(math.huge) < math.huge);
		Assert.equal(loadCrystals(2.7) % 1, 0);
	}
}

export = SanitizeCrystalsTests;
