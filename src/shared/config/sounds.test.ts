import { Assert, Test } from "@rbxts/lunit";
import { SOUNDS, SOUND_IDS, isValidAssetId } from "./sounds";

class SoundConfigTests {
	@Test
	public everySoundIsValid() {
		for (const id of SOUND_IDS) {
			const def = SOUNDS[id];
			Assert.true(isValidAssetId(def.assetId), `${id}: bad assetId "${def.assetId}"`);
			Assert.true(def.volume >= 0 && def.volume <= 1, `${id}: volume out of 0..1`);
			Assert.true(def.minGap >= 0 && def.minGap < 5, `${id}: minGap out of range`);
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
