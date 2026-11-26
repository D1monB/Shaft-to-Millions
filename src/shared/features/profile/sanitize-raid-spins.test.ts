import { Assert, Test } from "@rbxts/lunit";
import { MAX_FREE_SPINS, PITY_SPINS } from "shared/config/aura-roll";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";

function loadWith(mutate: (raw: PlainTable) => void) {
	const raw = createDefaultProfileData() as unknown as PlainTable;
	mutate(raw);
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`load failed: ${result.reason}`);
		throw "unreachable";
	}
	return result;
}

// Raids and the aura machine (decisions 064-065) in old and broken saves.
class SanitizeRaidSpinsTests {
	@Test
	public oldSavesGetDefaultsWithoutRepairs() {
		const old = loadWith((raw) => {
			raw.raid = undefined;
			raw.auraRoll = undefined;
		});
		Assert.equal(old.data.raid.best, 0);
		Assert.true(old.data.auraRoll.spins > 0);
		Assert.equal(old.repairs.size(), 0);
	}

	@Test
	public junkIsRepairedNeverRefused() {
		const result = loadWith((raw) => {
			raw.raid = { week: -3, best: 0 / 0, startedAt: math.huge } as unknown as PlainTable;
			raw.auraRoll = { spins: 999, spinAt: -1, pity: 1e9 } as unknown as PlainTable;
		});
		Assert.equal(result.data.raid.week, 0);
		Assert.equal(result.data.raid.best, 0);
		Assert.equal(result.data.auraRoll.spins, MAX_FREE_SPINS);
		Assert.equal(result.data.auraRoll.pity, PITY_SPINS);
		for (const junk of [5, "x", true]) {
			Assert.equal(loadWith((raw) => (raw.raid = junk)).data.raid.best, 0);
		}
	}
}

export = SanitizeRaidSpinsTests;
