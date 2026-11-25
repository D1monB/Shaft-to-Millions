import { Assert, Test } from "@rbxts/lunit";
import { ORE_IDS } from "./ores";
import { ORE_BREAK_SOUNDS, SOUNDS, SOUND_IDS, SoundDef, isValidAssetId } from "./sounds";

function checkDef(name: string, def: SoundDef): void {
	Assert.true(isValidAssetId(def.assetId), `${name}: bad assetId "${def.assetId}"`);
	Assert.true(def.volume >= 0 && def.volume <= 1, `${name}: volume out of 0..1`);
	Assert.true(def.minGap >= 0 && def.minGap < 5, `${name}: minGap out of range`);
	const speed = def.speed ?? 1;
	Assert.true(speed >= 0.5 && speed <= 2, `${name}: speed out of 0.5..2`);
}

class SoundConfigTests {
	@Test
	public everySoundIsValid() {
		for (const id of SOUND_IDS) {
			checkDef(id, SOUNDS[id]);
		}
	}

	@Test
	public everyOreHasItsOwnBreakSound() {
		const seen = new Set<string>();
		for (const id of ORE_IDS) {
			const def = ORE_BREAK_SOUNDS[id];
			checkDef(`ore ${id}`, def);
			Assert.true(def.assetId !== "", `ore ${id}: silent break sound`);
			// Same file is fine when the pitch differs: the pair must be unique.
			const key = `${def.assetId}@${def.speed ?? 1}`;
			Assert.false(seen.has(key), `ore ${id}: sounds exactly like another ore`);
			seen.add(key);
		}
	}

	@Test
	public assetIdFormat() {
		Assert.true(isValidAssetId(""));
		Assert.true(isValidAssetId("rbxassetid://123456"));
		Assert.false(isValidAssetId("123456"));
		Assert.false(isValidAssetId("rbxassetid://"));
		Assert.false(isValidAssetId("rbxassetid://12a"));
		Assert.false(isValidAssetId("http://example.com/a.mp3"));
	}
}

export = SoundConfigTests;
