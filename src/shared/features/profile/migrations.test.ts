import { Assert, Test } from "@rbxts/lunit";
import { PlainTable } from "shared/lib/tables";
import { MIGRATIONS, Migration, isMigrationChainComplete, migrate } from "./migrations";
import { CURRENT_SCHEMA_VERSION } from "./schema";
import { findGear } from "shared/features/upgrades";

// Fake two-step history, used only here: v1 had `coins`, v2 renamed it to `gold`, v3 added a `title`.
const fakeChain: ReadonlyArray<Migration> = [
	{
		from: 1,
		apply: (data) => {
			data.gold = data.coins;
			data.coins = undefined;
		},
	},
	{
		from: 2,
		apply: (data) => {
			data.title = "newcomer";
		},
	},
];

class MigrationsTests {
	@Test
	public realChainCoversEveryVersion() {
		// Fails CI if someone bumps CURRENT_SCHEMA_VERSION without adding a migration.
		Assert.true(isMigrationChainComplete(MIGRATIONS, CURRENT_SCHEMA_VERSION));
	}

	@Test
	public incompleteChainIsDetected() {
		Assert.false(isMigrationChainComplete([], 2));
		Assert.false(isMigrationChainComplete([fakeChain[1]], 3));
		Assert.true(isMigrationChainComplete(fakeChain, 3));
	}

	@Test
	public appliesStepsInOrderAndBumpsVersion() {
		const result = migrate({ schemaVersion: 1, coins: 7 }, fakeChain, 3);
		if (!result.ok) {
			Assert.fail("migration should succeed");
		}
		Assert.equal(result.data.schemaVersion, 3);
		Assert.equal(result.data.gold, 7);
		Assert.undefined(result.data.coins);
		Assert.equal(result.data.title, "newcomer");
	}

	@Test
	public startsFromTheSavedVersion() {
		const result = migrate({ schemaVersion: 2, gold: 5 }, fakeChain, 3);
		if (!result.ok) {
			Assert.fail("migration should succeed");
		}
		Assert.equal(result.data.gold, 5);
		Assert.equal(result.data.title, "newcomer");
	}

	@Test
	public currentVersionIsReturnedUnchanged() {
		const result = migrate({ schemaVersion: 3, gold: 5 }, fakeChain, 3);
		Assert.true(result.ok);
	}

	@Test
	public neverModifiesTheInput() {
		const original: PlainTable = { schemaVersion: 1, coins: 7 };
		migrate(original, fakeChain, 3);
		Assert.equal(original.schemaVersion, 1);
		Assert.equal(original.coins, 7);
		Assert.undefined(original.gold);
	}

	@Test
	public failingStepLeavesInputUntouched() {
		const broken: ReadonlyArray<Migration> = [
			{
				from: 1,
				apply: (data) => {
					data.gold = 1;
					error("boom");
				},
			},
		];
		const original: PlainTable = { schemaVersion: 1 };
		const result = migrate(original, broken, 2);
		Assert.false(result.ok);
		if (!result.ok) {
			Assert.equal(result.reason, "migration-failed");
		}
		Assert.undefined(original.gold);
		Assert.equal(original.schemaVersion, 1);
	}

	@Test
	public missingStepIsAFailureNotACrash() {
		const result = migrate({ schemaVersion: 1 }, [], 2);
		Assert.false(result.ok);
	}

	@Test
	public refusesDataFromTheFuture() {
		const result = migrate({ schemaVersion: 4 }, fakeChain, 3);
		Assert.false(result.ok);
		if (!result.ok) {
			Assert.equal(result.reason, "future-version");
		}
	}

	@Test
	public rejectsBadVersions() {
		const badVersions: unknown[] = [undefined, 0, -1, 1.5, "1", 0 / 0, math.huge, -math.huge, {}, true];
		for (const version of badVersions) {
			const result = migrate({ schemaVersion: version }, fakeChain, 3);
			Assert.false(result.ok, `version should be rejected: ${tostring(version)}`);
			if (!result.ok) {
				Assert.equal(result.reason, "invalid-version");
			}
		}
	}

	@Test
	public version2AddsUpgradeLevelsWithoutTouchingTheRest() {
		const old = {
			schemaVersion: 1,
			money: 5,
			levels: { pickaxe: 2, bag: 1, shoes: 1 },
			machines: {
				furnace: { queue: ["smelt_copper"], startedAt: 7, ready: {} },
				workbench: { queue: [], startedAt: 0, ready: {}, speedLevel: 3 },
			},
		} as unknown as PlainTable;
		const result = migrate(old, MIGRATIONS, 2);
		if (!result.ok) {
			Assert.fail(`migration failed: ${result.reason}`);
			return;
		}
		const data = result.data as unknown as {
			schemaVersion: number;
			money: number;
			levels: { pickaxe: number; warehouse: number };
			machines: {
				furnace: { speedLevel: number; queueLevel: number; startedAt: number };
				workbench: { speedLevel: number };
			};
		};
		Assert.equal(data.schemaVersion, 2);
		Assert.equal(data.money, 5);
		Assert.equal(data.levels.pickaxe, 2);
		Assert.equal(data.levels.warehouse, 1);
		Assert.equal(data.machines.furnace.speedLevel, 1);
		Assert.equal(data.machines.furnace.queueLevel, 1);
		Assert.equal(data.machines.furnace.startedAt, 7);
		// An upgrade that already exists is never reset.
		Assert.equal(data.machines.workbench.speedLevel, 3);
	}

	@Test
	public version2MigrationSurvivesSavesWithoutMachinesOrLevels() {
		Assert.true(migrate({ schemaVersion: 1 } as PlainTable, MIGRATIONS, 2).ok);
		Assert.true(migrate({ schemaVersion: 1, levels: "x", machines: 5 } as unknown as PlainTable, MIGRATIONS, 2).ok);
	}

	@Test
	public version3TurnsGearLevelsIntoOwnedItems() {
		const old = {
			schemaVersion: 2,
			money: 9,
			levels: { pickaxe: 3, bag: 6, shoes: 1, warehouse: 2 },
		} as unknown as PlainTable;
		const result = migrate(old, MIGRATIONS, 3);
		if (!result.ok) {
			Assert.fail(`migration failed: ${result.reason}`);
			return;
		}
		const data = result.data as unknown as {
			money: number;
			levels: { pickaxe?: number; bag?: number; shoes?: number; warehouse: number };
			gear: { owned: string[]; equipped: { pickaxe: string; bag: string; shoes: string } };
		};
		Assert.equal(data.money, 9);
		Assert.equal(data.levels.warehouse, 2);
		Assert.undefined(data.levels.pickaxe);
		Assert.undefined(data.levels.bag);
		Assert.undefined(data.levels.shoes);
		// Old level 3 (ore tier 3) becomes the gold pickaxe: the same ore tier, never weaker.
		Assert.equal(data.gear.equipped.pickaxe, "pickaxe_gold");
		Assert.equal(data.gear.equipped.bag, "bag_gravity");
		Assert.equal(data.gear.equipped.shoes, "shoes_old");
		Assert.true(data.gear.owned.includes("pickaxe_wood"));
		Assert.true(data.gear.owned.includes("pickaxe_gold"));
		Assert.true(data.gear.owned.includes("shoes_old"));
		Assert.equal(data.gear.owned.size(), 5);
	}

	@Test
	public version3MapsEveryOldLevelToAnItemOfTheSameSlot() {
		for (let level = 1; level <= 6; level++) {
			const raw = { schemaVersion: 2, levels: { pickaxe: level, bag: level, shoes: level, warehouse: 1 } };
			const result = migrate(raw as unknown as PlainTable, MIGRATIONS, 3);
			Assert.true(result.ok);
			if (result.ok) {
				const equipped = (result.data.gear as { equipped: { [slot: string]: string } }).equipped;
				for (const slot of ["pickaxe", "bag", "shoes"]) {
					Assert.equal(findGear(equipped[slot])?.slot, slot);
				}
			}
		}
	}

	@Test
	public version3SurvivesBrokenLevels() {
		for (const levels of [undefined, "x", { pickaxe: 0 / 0, bag: -3, shoes: math.huge }]) {
			const result = migrate({ schemaVersion: 2, levels } as unknown as PlainTable, MIGRATIONS, 3);
			Assert.true(result.ok);
			if (result.ok) {
				const equipped = (result.data.gear as { equipped: { [slot: string]: string } }).equipped;
				Assert.equal(equipped.pickaxe, "pickaxe_wood");
				Assert.equal(equipped.bag, "bag_sack");
				Assert.notUndefined(findGear(equipped.shoes));
			}
		}
	}
}

export = MigrationsTests;
