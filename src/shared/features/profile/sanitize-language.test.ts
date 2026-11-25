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

// The language choice (decision 033): only our languages or "" (automatic) survive a load.
class SanitizeLanguageTests {
	@Test
	public newAndOldSavesAreAutomatic() {
		Assert.equal(createDefaultProfileData().language, "");
		// A save from before the field existed gets the default, without a repair.
		const old = loadWith((raw) => (raw.language = undefined));
		Assert.equal(old.data.language, "");
		Assert.false(old.repairs.includes("language"));
	}

	@Test
	public keepsAChosenLanguage() {
		for (const language of ["en", "uk", "ru", "pl"]) {
			Assert.equal(loadWith((raw) => (raw.language = language)).data.language, language);
		}
	}

	@Test
	public junkBecomesAutomatic() {
		for (const junk of ["klingon", "UK", " uk", 5, 0 / 0, math.huge, true, {}]) {
			const result = loadWith((raw) => (raw.language = junk));
			Assert.equal(result.data.language, "");
			Assert.true(result.repairs.includes("language"));
		}
	}
}

export = SanitizeLanguageTests;
