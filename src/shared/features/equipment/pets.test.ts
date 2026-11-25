import { Assert, Test } from "@rbxts/lunit";
import { ITEMS } from "shared/config/items";
import { MAX_PETS } from "./equipment";
import { decodePets, encodePets, followAlpha, petOffset } from "./pets";

class PetsTests {
	@Test
	public encodeAndDecodeRoundTrip() {
		const ids = ["pet_mole", "pet_golem"] as const;
		Assert.equal(decodePets(encodePets(ids)).join(","), "pet_mole,pet_golem");
		Assert.equal(decodePets(encodePets([])).size(), 0);
	}

	@Test
	public decodeRejectsEverythingThatIsNotAPetId() {
		Assert.equal(decodePets(undefined).size(), 0);
		Assert.equal(decodePets(5).size(), 0);
		Assert.equal(decodePets({}).size(), 0);
		Assert.equal(decodePets("").size(), 0);
		Assert.equal(decodePets("nope,also_nope").size(), 0);
		// Auras are real items but not pets.
		Assert.equal(decodePets("aura_breeze,paura_core").size(), 0);
		// Junk between valid ids is skipped, the valid ones stay.
		Assert.equal(decodePets("pet_mole,???,pet_beetle").join(","), "pet_mole,pet_beetle");
	}

	@Test
	public decodeCapsTheNumberOfPets() {
		const many = "pet_mole,pet_mole,pet_mole,pet_mole,pet_mole,pet_mole,pet_mole";
		Assert.equal(decodePets(many).size(), MAX_PETS);
	}

	@Test
	public decodedIdsAreReallyPets() {
		for (const id of decodePets("pet_mole,pet_beetle,pet_moth")) {
			Assert.equal(ITEMS[id].kind, "pet");
		}
	}

	@Test
	public offsetsAreFiniteAndNearTheOwner() {
		for (let count = 1; count <= MAX_PETS; count++) {
			for (let index = 0; index < count; index++) {
				for (const time of [0, 1.5, 123.456, 100000]) {
					const offset = petOffset(index, count, time);
					Assert.true(offset.x === offset.x && math.abs(offset.x) < 10);
					Assert.true(offset.y > 1 && offset.y < 3);
					Assert.true(offset.z > 2 && offset.z < 4);
				}
			}
		}
	}

	@Test
	public petsFanOutSideBySideAndAreSymmetric() {
		const first = petOffset(0, 3, 0);
		const middle = petOffset(1, 3, 0);
		const last = petOffset(2, 3, 0);
		Assert.true(first.x < middle.x && middle.x < last.x);
		Assert.true(math.abs(first.x + last.x) < 0.0001);
		Assert.equal(middle.x, 0);
		// One pet floats right behind the owner.
		Assert.equal(petOffset(0, 1, 0).x, 0);
	}

	@Test
	public petsBobOnTheirOwnBeat() {
		Assert.notEqual(petOffset(0, 2, 1).y, petOffset(1, 2, 1).y);
		Assert.notEqual(petOffset(0, 1, 0).y, petOffset(0, 1, 1).y);
	}

	@Test
	public offsetSurvivesBrokenInput() {
		for (const bad of [0 / 0, math.huge, -math.huge]) {
			const offset = petOffset(bad, bad, bad);
			Assert.true(offset.x === offset.x && offset.y === offset.y && offset.z === offset.z);
			Assert.true(math.abs(offset.x) < 10 && math.abs(offset.y) < 10 && math.abs(offset.z) < 10);
		}
		const outOfRange = petOffset(99, 2, 0);
		Assert.equal(outOfRange.x, petOffset(1, 2, 0).x);
		Assert.equal(petOffset(-5, 2, 0).x, petOffset(0, 2, 0).x);
	}

	@Test
	public followAlphaIsBetweenZeroAndOne() {
		Assert.equal(followAlpha(0, 8), 0);
		const small = followAlpha(1 / 60, 8);
		const big = followAlpha(1, 8);
		Assert.true(small > 0 && small < big && big < 1);
	}

	@Test
	public followIsFrameRateIndependent() {
		// Two frames of 1/60 s leave the same distance as one frame of 1/30 s.
		const slowFrame = 1 - followAlpha(1 / 30, 8);
		const twoFastFrames = (1 - followAlpha(1 / 60, 8)) * (1 - followAlpha(1 / 60, 8));
		Assert.true(math.abs(slowFrame - twoFastFrames) < 0.0001);
	}

	@Test
	public followAlphaSurvivesBrokenInput() {
		for (const bad of [0 / 0, -1, -math.huge, math.huge]) {
			Assert.equal(followAlpha(bad, 8), 0);
			Assert.equal(followAlpha(1 / 60, bad), 0);
		}
	}
}

export = PetsTests;
