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

	// ---- version 4: new ores (decisions 027) ----

	private migrateV4(data: PlainTable): PlainTable {
		data.schemaVersion = 3;
		const result = migrate(data, MIGRATIONS, 4);
		Assert.true(result.ok);
		return result.ok ? result.data : {};
	}

	@Test
	public version4PaysForRemovedOresAndProducts() {
		const data = this.migrateV4({
			money: 100,
			bag: { coal: 10, quartz: 2, iron: 3 },
			warehouse: { silver: 1, cobalt: 1, silver_ingot: 2, silver_contact: 1, copper_ingot: 4 },
		});
		// 10x2 + 2x25 + 20 + 150 + 2x65 + 230
		Assert.equal(data.money, 100 + 20 + 50 + 20 + 150 + 130 + 230);
		Assert.deepEqual(data.bag, { iron: 3 });
		Assert.deepEqual(data.warehouse, { copper_ingot: 4 });
	}

	@Test
	public version4RemovesDeadRecipesAndRefundsThem() {
		const data = this.migrateV4({
			money: 0,
			machines: {
				furnace: { queue: ["smelt_silver", "smelt_copper", "smelt_gold"], ready: { silver_ingot: 1 } },
				workbench: { queue: ["make_contact", "make_circuit", 7, "unknown_recipe"], ready: {} },
			},
		});
		// smelt_silver 42 + smelt_gold 2 + ready silver ingot 65 + make_contact 145 + make_circuit 25
		Assert.equal(data.money, 42 + 2 + 65 + 145 + 25);
		const machines = data.machines as { [id: string]: { queue: string[] } };
		Assert.deepEqual(machines.furnace.queue, ["smelt_copper", "smelt_gold"]);
		Assert.deepEqual(machines.workbench.queue, ["make_circuit", "unknown_recipe"]);
	}

	@Test
	public version4PaysNothingForCraftsSanitizeWouldDrop() {
		const longQueue: string[] = [];
		for (let i = 0; i < 100; i++) {
			longQueue.push("smelt_silver");
		}
		const data = this.migrateV4({
			money: 0,
			machines: {
				workbench: { queue: ["smelt_silver", "smelt_gold"], ready: {} }, // furnace recipes on the wrong machine
				furnace: { queue: longQueue, ready: {} },
			},
		});
		// Only the first 30 (the old queue cap) furnace crafts count.
		Assert.equal(data.money, 30 * 42);
	}

	@Test
	public version4MovesDrillsToTheirLayerOre() {
		const data = this.migrateV4({
			money: 0,
			drills: {
				layer1: { oreId: "coal", buffer: 10, progress: 3 },
				layer2: { oreId: "iron", buffer: 5, progress: 1 },
				layer3: { oreId: "gold", buffer: 2, progress: 1 },
				layer9: { oreId: "coal", buffer: 99 },
			},
		});
		const drills = data.drills as { [key: string]: { oreId: string; buffer: number } };
		Assert.equal(drills.layer1.oreId, "copper");
		Assert.equal(drills.layer1.buffer, 0);
		Assert.equal(drills.layer2.buffer, 5, "iron is still the layer 2 ore");
		Assert.equal(drills.layer3.buffer, 2);
		Assert.equal(drills.layer9.buffer, 99, "an unknown layer is left to sanitize");
		Assert.equal(data.money, 10 * 2);
	}

	// ---- version 5: the tycoon line replaces the recipe factory (decisions 027) ----

	private migrateV5(data: PlainTable): PlainTable {
		data.schemaVersion = 4;
		const result = migrate(data, MIGRATIONS, 5);
		Assert.true(result.ok);
		return result.ok ? result.data : {};
	}

	@Test
	public version5PaysBackMachinesUpgradesAndStock() {
		const data = this.migrateV5({
			money: 10,
			levels: { warehouse: 4 },
			warehouse: { copper: 10, gold_circuit: 1, unknown_thing: 50 },
			machines: {
				furnace: { speedLevel: 4, queueLevel: 1, queue: ["smelt_gold"], ready: { gold_ingot: 2 } },
				workbench: { speedLevel: 1, queueLevel: 2, queue: [], ready: {} },
			},
		});
		const warehouse = 10 * 5 + 520 + (2_000 + 10_000 + 50_000);
		const furnace = 400 + (1_500 + 6_000 + 25_000) + 60 + 2 * 140;
		const workbench = 3_000 + 5_000;
		Assert.equal(data.money, 10 + warehouse + furnace + workbench);
		Assert.undefined(data.warehouse);
		Assert.undefined(data.machines);
		Assert.undefined(data.levels);
	}

	@Test
	public migrationsNeverPayForMoreThanTheOldGameAllowed() {
		// Regression (security review): a save broken by an old dupe must not be laundered into money.
		const v4 = this.migrateV4({ money: 0, bag: { coal: 1e9 }, warehouse: { silver_contact: 1e9 } });
		Assert.equal(v4.money, 800 * 2 + 8_000 * 230);
		const v5 = this.migrateV5({
			money: 0,
			warehouse: { gold_circuit: 1e9, copper: 1e9 },
			machines: { furnace: { ready: { gold_ingot: 1e9 } } },
		});
		// The best pieces first: 8 000 circuits fill the warehouse cap, copper gets nothing; 30 ingots in the furnace.
		Assert.equal(v5.money, 8_000 * 520 + 400 + 30 * 140);
	}

	@Test
	public version5WithoutAFactoryPaysNothing() {
		const data = this.migrateV5({ money: 77 });
		Assert.equal(data.money, 77);
	}

	@Test
	public version5SurvivesBrokenData() {
		const broken = [
			{ money: 0 / 0, levels: "x", warehouse: 5, machines: "y" },
			{ levels: { warehouse: math.huge }, machines: { furnace: { speedLevel: 0 / 0, queue: "x", ready: 3 } } },
			{ machines: { furnace: "x", laser: { speedLevel: 4 } }, warehouse: { copper: -5, gold: 0 / 0 } },
		];
		for (const save of broken) {
			const data = this.migrateV5(save as unknown as PlainTable);
			const money = data.money as number;
			Assert.true(money === money && money >= 0 && money < math.huge, `money ${money}`);
		}
		// An infinite warehouse level is broken data: it counts as level 1 (nothing paid), never as infinite money.
		const top = this.migrateV5({ money: 0, levels: { warehouse: math.huge } });
		Assert.equal(top.money, 0);
	}

	@Test
	public version4SurvivesBrokenData() {
		const broken = [
			{ money: 0 / 0, bag: "x", warehouse: 5, machines: "y", drills: 3 },
			{ bag: { coal: -5, quartz: 0 / 0, silver: math.huge }, machines: { furnace: { queue: "nope" } } },
			{ drills: { layer1: { oreId: 5, buffer: -3 } }, machines: { furnace: "x" } },
		];
		for (const save of broken) {
			const data = this.migrateV4(save as unknown as PlainTable);
			const money = data.money as number;
			Assert.true(money === money && money >= 0 && money < math.huge, `money ${money}`);
		}
	}
}

export = MigrationsTests;
