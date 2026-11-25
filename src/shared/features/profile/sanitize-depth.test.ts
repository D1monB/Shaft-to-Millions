import { Assert, Test } from "@rbxts/lunit";
import { MAX_DEPTH_METERS } from "shared/config/layers";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";

function loadWith(mutate: (raw: PlainTable) => void) {
	const raw = createDefaultProfileData() as unknown as PlainTable;
	mutate(raw);
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`load failed: ${result.reason}`);
	}
	return result;
}

// The depth record (deepestMeters) feeds the depth leaderboard, so a broken value must never reach it.
class SanitizeDepthTests {
	@Test
	public newPlayerStartsAtTheSurface() {
		Assert.equal(createDefaultProfileData().deepestMeters, 0);
	}

	@Test
	public oldSaveWithoutTheFieldGetsZero() {
		const result = loadWith((raw) => {
			raw.deepestMeters = undefined;
		});
		Assert.equal(result.data.deepestMeters, 0);
	}

	@Test
	public brokenDepthIsRepaired() {
		const cases: unknown[] = [-5, 0 / 0, math.huge, "deep", 12.7];
		for (const value of cases) {
			const result = loadWith((raw) => {
				raw.deepestMeters = value;
			});
			const meters = result.data.deepestMeters;
			Assert.true(meters >= 0 && meters <= MAX_DEPTH_METERS && math.floor(meters) === meters);
		}
	}

	@Test
	public tooDeepIsClamped() {
		const result = loadWith((raw) => {
			raw.deepestMeters = MAX_DEPTH_METERS * 100;
		});
		Assert.equal(result.data.deepestMeters, MAX_DEPTH_METERS);
	}

	@Test
	public validDepthIsKept() {
		const result = loadWith((raw) => {
			raw.deepestMeters = 345;
		});
		Assert.equal(result.data.deepestMeters, 345);
		Assert.equal(result.repairs.size(), 0);
	}
}

export = SanitizeDepthTests;
