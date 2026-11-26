import { Assert, Test } from "@rbxts/lunit";
import { BOOSTER_IDS } from "shared/config/boosters";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";

// Same bound as sanitize.ts (year 2100 in unix seconds).
const MAX_TIMESTAMP = 4_102_444_800;

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

// Booster end times (decision 057): unix seconds, 0 = off. Broken values must never become a permanent boost.
class SanitizeBoostsTests {
	@Test
	public newAndOldSavesHaveEveryBoosterOff() {
		const fresh = createDefaultProfileData();
		const old = loadWith((raw) => (raw.boosts = undefined));
		for (const id of BOOSTER_IDS) {
			Assert.equal(fresh.boosts[id], 0);
			Assert.equal(old.data.boosts[id], 0);
		}
		// A save from before boosters existed is not "damaged".
		Assert.equal(old.repairs.size(), 0);
	}

	@Test
	public keepsValidEndTimes() {
		const result = loadWith((raw) => (raw.boosts = { money: 1_700_000_000, ore: 0, line: MAX_TIMESTAMP }));
		Assert.equal(result.data.boosts.money, 1_700_000_000);
		Assert.equal(result.data.boosts.ore, 0);
		Assert.equal(result.data.boosts.line, MAX_TIMESTAMP);
		Assert.equal(result.repairs.size(), 0);
	}

	@Test
	public junkValuesAreRepairedIntoRange() {
		for (const junk of [-5, 0 / 0, math.huge, -math.huge, "x", 1e15, true, {}]) {
			const result = loadWith((raw) => (raw.boosts = { money: junk, ore: 0, line: 0 }));
			const fixed = result.data.boosts.money;
			Assert.true(typeIs(fixed, "number"));
			Assert.true(fixed === fixed);
			Assert.true(fixed >= 0 && fixed <= MAX_TIMESTAMP);
			Assert.true(result.repairs.includes("boosts.money"));
		}
	}

	@Test
	public outOfRangeNumbersAreClamped() {
		const result = loadWith((raw) => (raw.boosts = { money: -5, ore: 1e15, line: 0 }));
		Assert.equal(result.data.boosts.money, 0);
		Assert.equal(result.data.boosts.ore, MAX_TIMESTAMP);
	}

	@Test
	public wholeFieldJunkBecomesARepairedTable() {
		for (const junk of ["x", 5, true, 0 / 0]) {
			const result = loadWith((raw) => (raw.boosts = junk));
			for (const id of BOOSTER_IDS) {
				Assert.equal(result.data.boosts[id], 0);
			}
			Assert.true(result.repairs.includes("boosts"));
		}
	}

	@Test
	public aMissingSingleBoosterIsFilledWithZero() {
		const result = loadWith((raw) => (raw.boosts = { money: 1_700_000_000 }));
		Assert.equal(result.data.boosts.money, 1_700_000_000);
		Assert.equal(result.data.boosts.ore, 0);
		Assert.equal(result.data.boosts.line, 0);
	}
}

export = SanitizeBoostsTests;
