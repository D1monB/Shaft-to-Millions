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

// The sound switch (decision 053): a boolean, sound on by default and for every broken value.
class SanitizeSoundTests {
	@Test
	public newAndOldSavesHaveSoundOn() {
		Assert.true(createDefaultProfileData().soundOn);
		const old = loadWith((raw) => (raw.soundOn = undefined));
		Assert.true(old.data.soundOn);
		Assert.false(old.repairs.includes("soundOn"));
	}

	@Test
	public keepsTheChoice() {
		Assert.false(loadWith((raw) => (raw.soundOn = false)).data.soundOn);
		Assert.true(loadWith((raw) => (raw.soundOn = true)).data.soundOn);
	}

	@Test
	public junkMeansSoundOn() {
		for (const junk of [0, 1, "false", 0 / 0, math.huge, {}]) {
			const result = loadWith((raw) => (raw.soundOn = junk));
			Assert.true(result.data.soundOn);
			Assert.true(result.repairs.includes("soundOn"));
		}
	}
}

export = SanitizeSoundTests;
