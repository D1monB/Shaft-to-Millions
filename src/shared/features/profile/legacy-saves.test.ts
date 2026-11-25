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

/**
 * What the version 4 migration (new ores) pays for the fixture: coal in the bag 4 x $2 and in the warehouse 12 x $2,
 * the coal a queued smelt_iron no longer takes ($2), and the drill on layer 1 whose iron moved to layer 2
 * (buffer 4 x $9).
 */
const V4_PAYOUT = 8 + 24 + 2 + 36;

/**
 * What the version 5 migration (no recipe factory, no warehouse) pays for the release-2 fixture: 3 copper ingots in the
 * warehouse (3 x $24), warehouse level 2 ($2 000), and the furnace: price $400, speed level 2 ($1 500), queue level 2
 * ($1 000), 2 finished copper ingots (2 x $24) and the queued smelt_copper ($15) and smelt_iron ($24).
 */
const V5_PAYOUT_V2 = 72 + 2_000 + 400 + 1_500 + 1_000 + 48 + 15 + 24;

/** The release-1 fixture has no warehouse or machine levels, so only the stock, the furnace price and its crafts. */
const V5_PAYOUT_V1 = 72 + 400 + 48 + 15 + 24;

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
		Assert.equal(data.money, 12_345 + V4_PAYOUT + V5_PAYOUT_V2);
		Assert.equal(data.stats.totalEarned, 98_765);
		Assert.equal(data.stats.oresMined, 321);
		Assert.equal(data.bag.iron, 7);
		Assert.equal(data.deepestLayer, 2);
		Assert.equal(data.nextUid, 3);
		Assert.equal(data.inventory.size(), 2);
		Assert.deepEqual(data.purchaseIds, ["receipt-abc"]);
		Assert.equal(data.equipped.speedAura, "i2");
		Assert.deepEqual(data.equipped.pets, ["i1"]);
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
		// The old levels are gone entirely (gear in v3, the warehouse level in v5).
		Assert.undefined((data as unknown as PlainTable).levels);
	}

	@Test
	public version4RemovedOresArePaidOutAndDrillsFollowTheirLayer() {
		const data = load(version2Save()).data;
		const bag = data.bag as unknown as PlainTable;
		Assert.undefined(bag.coal);
		Assert.equal(data.drills.layer1?.oreId, "copper");
		Assert.equal(data.drills.layer1?.buffer, 0);
	}

	@Test
	public version5RemovesTheFactoryAndStartsAnEmptyLine() {
		const raw = load(version2Save()).data as unknown as PlainTable;
		Assert.undefined(raw.warehouse);
		Assert.undefined(raw.machines);
		const data = load(version2Save()).data;
		Assert.equal(data.line.machines.size(), 0);
		Assert.equal(data.lastSeen, 0);
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
		Assert.equal(result.data.money, 12_345 + V4_PAYOUT + V5_PAYOUT_V1);
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
