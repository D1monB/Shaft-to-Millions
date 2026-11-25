import { Assert, Test } from "@rbxts/lunit";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { CURRENT_SCHEMA_VERSION } from "./schema";

// Whole saves as older releases wrote them, run through the REAL pipeline (migrate -> defaults -> repair -> shape).
// The per-step tests in migrations.test.ts check one step each; these check that a real player's save survives
// the full journey with every unrelated field intact. The fixtures are frozen: never edit them to match new code,
// fix the code (or write a new migration) instead.

/** A save from release 2: gear is still levels, there is no `gear` and no `deepestMeters`. */
function version2Save(): PlainTable {
	return {
		schemaVersion: 2,
		money: 12_345,
		stats: { totalEarned: 98_765, oresMined: 321 },
		bag: { coal: 4, iron: 7 },
		levels: { pickaxe: 3, bag: 2, shoes: 4, warehouse: 2 },
		warehouse: { iron_ore: 0, coal: 12, copper_ingot: 3 },
		machines: {
			furnace: {
				queue: ["smelt_copper", "smelt_iron"],
				startedAt: 1_700_000_000,
				ready: { copper_ingot: 2 },
				speedLevel: 2,
				queueLevel: 2,
			},
		},
		deepestLayer: 2,
		drills: { layer1: { oreId: "iron", lastTick: 1_700_000_100, progress: 3.5, buffer: 4 } },
		inventory: [
			{ uid: "i1", item: "pet_mole" },
			{ uid: "i2", item: "aura_breeze" },
		],
		nextUid: 3,
		purchaseIds: ["receipt-abc"],
		equipped: { speedAura: "i2", pets: ["i1"] },
	} as unknown as PlainTable;
}

/** A save from release 1: no upgrade levels at all. */
function version1Save(): PlainTable {
	const save = version2Save();
	save.schemaVersion = 1;
	save.levels = { pickaxe: 2, bag: 1, shoes: 1 };
	const machines = save.machines as { furnace: PlainTable };
	machines.furnace.speedLevel = undefined;
	machines.furnace.queueLevel = undefined;
	return save;
}

function load(raw: PlainTable) {
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`legacy save was refused: ${result.reason} ${result.detail ?? ""}`);
	}
	return result;
}

class LegacySaveTests {
	@Test
	public version2SaveLoadsAtTheCurrentVersionWithoutRepairs() {
		const result = load(version2Save());
		Assert.equal(result.data.schemaVersion, CURRENT_SCHEMA_VERSION);
		// Nothing had to be repaired: a repair means the migration produced something invalid.
		Assert.equal(result.repairs.size(), 0);
	}

	@Test
	public version2SaveKeepsEverythingThatIsNotGear() {
		const data = load(version2Save()).data;
		Assert.equal(data.money, 12_345);
		Assert.equal(data.stats.totalEarned, 98_765);
		Assert.equal(data.stats.oresMined, 321);
		Assert.equal(data.bag.coal, 4);
		Assert.equal(data.bag.iron, 7);
		Assert.equal(data.levels.warehouse, 2);
		Assert.equal(data.warehouse.coal, 12);
		Assert.equal(data.warehouse.copper_ingot, 3);
		Assert.equal(data.deepestLayer, 2);
		Assert.equal(data.nextUid, 3);
		Assert.equal(data.inventory.size(), 2);
		Assert.deepEqual(data.purchaseIds, ["receipt-abc"]);
		Assert.equal(data.equipped.speedAura, "i2");
		Assert.deepEqual(data.equipped.pets, ["i1"]);
		const furnace = data.machines.furnace;
		Assert.notUndefined(furnace);
		Assert.equal(furnace?.queue.size(), 2);
		Assert.equal(furnace?.speedLevel, 2);
		Assert.equal(furnace?.queueLevel, 2);
		Assert.equal(furnace?.startedAt, 1_700_000_000);
		Assert.equal(furnace?.ready.copper_ingot, 2);
	}

	@Test
	public version2GearLevelsBecomeOwnedItemsNeverWeaker() {
		const data = load(version2Save()).data;
		// Old level 3 pickaxe (gold), level 2 bag (leather), level 4 shoes (spring): equipped and owned.
		Assert.equal(data.gear.equipped.pickaxe, "pickaxe_gold");
		Assert.equal(data.gear.equipped.bag, "bag_leather");
		Assert.equal(data.gear.equipped.shoes, "shoes_spring");
		for (const id of [data.gear.equipped.pickaxe, data.gear.equipped.bag, data.gear.equipped.shoes]) {
			Assert.true(data.gear.owned.includes(id), `${id} is equipped but not owned`);
		}
		// The old per-slot levels are gone: no leftover fields the new code would misread.
		const levels = data.levels as unknown as PlainTable;
		Assert.undefined(levels.pickaxe);
		Assert.undefined(levels.bag);
		Assert.undefined(levels.shoes);
	}

	@Test
	public version2SaveGetsTheNewFieldsWithDefaults() {
		const data = load(version2Save()).data;
		Assert.equal(data.deepestMeters, 0);
	}

	@Test
	public version1SaveAlsoReachesTheCurrentVersion() {
		const result = load(version1Save());
		Assert.equal(result.data.schemaVersion, CURRENT_SCHEMA_VERSION);
		Assert.equal(result.repairs.size(), 0);
		Assert.equal(result.data.money, 12_345);
		Assert.equal(result.data.levels.warehouse, 1);
		Assert.equal(result.data.machines.furnace?.speedLevel, 1);
		Assert.equal(result.data.gear.equipped.pickaxe, "pickaxe_iron");
	}

	@Test
	public loadingTwiceChangesNothingTheSecondTime() {
		const first = load(version2Save()).data;
		const second = load(first as unknown as PlainTable);
		Assert.equal(second.repairs.size(), 0);
		Assert.deepEqual(second.data, first);
	}

	@Test
	public theOriginalSaveObjectIsNeverModified() {
		// A failed or refused load must leave the stored save as it was, so the player's data is never half-migrated.
		const raw = version2Save();
		load(raw);
		Assert.equal(raw.schemaVersion, 2);
		Assert.notUndefined((raw.levels as PlainTable).pickaxe);
		Assert.undefined(raw.gear);
	}

	@Test
	public aSaveFromTheFutureIsRefusedNotTruncated() {
		const raw = version2Save();
		raw.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
		const result = loadProfileData(raw);
		Assert.false(result.ok);
		Assert.equal(raw.schemaVersion, CURRENT_SCHEMA_VERSION + 1);
	}
}

export = LegacySaveTests;
