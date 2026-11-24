import { Assert, Test } from "@rbxts/lunit";
import { MAX_COUNTER } from "shared/lib/repair";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { Migration } from "./migrations";
import { CURRENT_SCHEMA_VERSION, createDefaultProfileData, isProfileData } from "./schema";
import { toPlayerView } from "./view";

function validRaw(): PlainTable {
	return createDefaultProfileData() as unknown as PlainTable;
}

function loadOk(raw: unknown) {
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`load should succeed, got ${result.reason}`);
	}
	return result;
}

class LoadProfileDataTests {
	@Test
	public defaultDataPassesTheShapeCheck() {
		Assert.true(isProfileData(createDefaultProfileData()));
		Assert.equal(createDefaultProfileData().schemaVersion, CURRENT_SCHEMA_VERSION);
	}

	@Test
	public defaultsAreNotSharedBetweenPlayers() {
		const first = createDefaultProfileData();
		first.stats.oresMined = 5;
		Assert.equal(createDefaultProfileData().stats.oresMined, 0);
	}

	@Test
	public acceptsAValidSaveUnchanged() {
		const raw = validRaw();
		raw.money = 500;
		const result = loadOk(raw);
		Assert.equal(result.data.money, 500);
		Assert.equal(result.repairs.size(), 0);
	}

	@Test
	public doesNotModifyTheInput() {
		const raw = validRaw();
		raw.money = -10;
		loadProfileData(raw);
		Assert.equal(raw.money, -10);
	}

	@Test
	public oldSaveWithoutNewFieldsGetsDefaults() {
		// A save from before `stats` existed must still load.
		const raw = validRaw();
		raw.stats = undefined;
		const result = loadOk(raw);
		Assert.equal(result.data.stats.totalEarned, 0);
	}

	@Test
	public unknownKeysSurvive() {
		const raw = validRaw();
		raw.futureFeature = { slots: 3 };
		const result = loadOk(raw);
		Assert.deepEqual((result.data as unknown as PlainTable).futureFeature, { slots: 3 });
	}

	@Test
	public isIdempotent() {
		const raw = validRaw();
		raw.money = -5;
		const first = loadOk(raw);
		const second = loadOk(first.data);
		Assert.deepEqual(second.data, first.data);
		Assert.equal(second.repairs.size(), 0);
	}

	@Test
	public migratesThroughAChain() {
		const chain: ReadonlyArray<Migration> = [{ from: 1, apply: (data) => (data.money = data.coins) }];
		const raw = validRaw();
		// The chain starts from version 1, so the save has to look like a version 1 save.
		raw.schemaVersion = 1;
		raw.money = undefined;
		raw.coins = 40;
		const result = loadProfileData(raw, chain, 2);
		if (!result.ok) {
			Assert.fail("should load");
		}
		Assert.equal(result.data.money, 40);
	}

	// ---- bad data: wrong types, out of range, hostile values ----

	@Test
	public repairsHostileNumbers() {
		const raw = validRaw();
		raw.money = 0 / 0;
		(raw.stats as PlainTable).totalEarned = math.huge;
		(raw.stats as PlainTable).oresMined = 2.7;
		const result = loadOk(raw);
		Assert.equal(result.data.money, 0);
		Assert.equal(result.data.stats.totalEarned, MAX_COUNTER);
		Assert.equal(result.data.stats.oresMined, 2);
		Assert.equal(result.repairs.size(), 3);
	}

	@Test
	public repairsWrongTypes() {
		const raw = validRaw();
		raw.money = "999999";
		raw.stats = 12;
		const result = loadOk(raw);
		Assert.equal(result.data.money, 0);
		Assert.equal(result.data.stats.oresMined, 0);
	}

	@Test
	public refusesDataThatIsNotATable() {
		for (const raw of [undefined, 5, "text", true]) {
			const result = loadProfileData(raw);
			Assert.false(result.ok);
		}
	}

	@Test
	public refusesFutureVersions() {
		const raw = validRaw();
		raw.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
		const result = loadProfileData(raw);
		Assert.false(result.ok);
		if (!result.ok) {
			Assert.equal(result.reason, "future-version");
		}
	}

	// ---- client view ----

	@Test
	public viewHidesPrivateFieldsAndIsACopy() {
		const data = createDefaultProfileData();
		(data as unknown as PlainTable).purchaseIds = ["receipt-1"];
		const view = toPlayerView(data);
		Assert.undefined((view as unknown as PlainTable).purchaseIds);
		view.money = 100;
		Assert.equal(data.money, 0);
	}
}

export = LoadProfileDataTests;
