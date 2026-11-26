import { Assert, Test } from "@rbxts/lunit";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";
import { toPlayerView } from "./view";

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

// Developer role and used promo codes (decision 068).
class SanitizeRolesTests {
	@Test
	public oldSavesAreNotDevelopers() {
		const old = loadWith((raw) => {
			raw.devRole = undefined;
			raw.redeemedCodes = undefined;
		});
		Assert.false(old.data.devRole);
		Assert.equal(old.data.redeemedCodes.size(), 0);
		Assert.equal(old.repairs.size(), 0);
	}

	@Test
	public junkNeverMakesADeveloper() {
		for (const junk of [1, "true", {}, 0 / 0]) {
			Assert.false(loadWith((raw) => (raw.devRole = junk)).data.devRole);
		}
		const codes = loadWith((raw) => (raw.redeemedCodes = ["GOOD", 5, "x".rep(40)] as unknown as PlainTable));
		Assert.equal(codes.data.redeemedCodes.size(), 1);
	}

	@Test
	public usedCodesStayPrivate() {
		const data = createDefaultProfileData();
		data.redeemedCodes.push("SECRET1");
		Assert.equal(toPlayerView(data).redeemedCodes, undefined);
	}
}

export = SanitizeRolesTests;
