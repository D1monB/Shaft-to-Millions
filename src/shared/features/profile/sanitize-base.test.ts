import { Assert, Test } from "@rbxts/lunit";
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

// The base (decision 063): broken saves are repaired, never refused.
class SanitizeBaseTests {
	@Test
	public oldSavesGetAnEmptyBase() {
		const old = loadWith((raw) => (raw.base = undefined));
		Assert.equal(old.data.base.builders, 1);
		Assert.equal(old.data.base.jobs.size(), 0);
		Assert.equal(old.repairs.size(), 0);
	}

	@Test
	public brokenLevelsJobsAndBuildersAreRepaired() {
		const result = loadWith((raw) => {
			raw.base = {
				levels: { office: 99, market: -4, hut: 0 / 0 },
				builders: 50,
				jobs: [
					{ id: "castle", finishAt: 5 },
					{ id: "hut", finishAt: math.huge },
					{ id: "hut", finishAt: 10 },
					"junk",
				],
			} as unknown as PlainTable;
		});
		const base = result.data.base;
		Assert.equal(base.levels.office, 6);
		Assert.equal(base.levels.market, 0);
		Assert.equal(base.levels.hut, 0);
		Assert.equal(base.builders, 3);
		Assert.equal(base.jobs.size(), 1);
		Assert.equal(base.jobs[0].id, "hut");
		Assert.true(base.jobs[0].finishAt <= 4_102_444_800);
	}

	@Test
	public junkBaseBecomesAFreshOne() {
		for (const junk of [5, "x", true]) {
			Assert.equal(loadWith((raw) => (raw.base = junk)).data.base.levels.office, 0);
		}
	}
}

export = SanitizeBaseTests;
