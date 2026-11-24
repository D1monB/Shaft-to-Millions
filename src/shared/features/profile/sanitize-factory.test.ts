import { Assert, Test } from "@rbxts/lunit";
import { MACHINE_UPGRADES } from "shared/config/machines";
import { queueLimitOf } from "shared/features/factory";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";

function load(mutate: (raw: PlainTable) => void) {
	const raw = createDefaultProfileData() as unknown as PlainTable;
	mutate(raw);
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`load failed: ${result.reason}`);
	}
	return result;
}

class SanitizeFactoryTests {
	@Test
	public newPlayerOwnsNoMachines() {
		const data = createDefaultProfileData();
		Assert.undefined(data.machines.furnace);
		Assert.deepEqual(data.warehouse, {});
	}

	@Test
	public keepsAValidMachine() {
		const result = load((raw) => {
			raw.machines = {
				furnace: {
					queue: ["smelt_copper"],
					startedAt: 1700000000,
					ready: { copper_ingot: 2 },
					speedLevel: 1,
					queueLevel: 1,
				},
			};
		});
		const furnace = result.data.machines.furnace;
		Assert.notUndefined(furnace);
		Assert.equal(furnace?.queue[0], "smelt_copper");
		Assert.equal(furnace?.ready.copper_ingot, 2);
		Assert.equal(result.repairs.size(), 0);
	}

	@Test
	public dropsUnknownAndForeignRecipes() {
		// "make_wire" belongs to the workbench: a furnace must not run it.
		const result = load((raw) => {
			raw.machines = {
				furnace: { queue: ["smelt_copper", "make_wire", "free_gold", 5], startedAt: 0, ready: {} },
			};
		});
		Assert.equal(result.data.machines.furnace?.queue.size(), 1);
	}

	@Test
	public capsAnOverlongQueue() {
		const result = load((raw) => {
			const queue: string[] = [];
			for (let i = 0; i < 500; i++) {
				queue.push("smelt_copper");
			}
			raw.machines = { furnace: { queue, startedAt: 0, ready: {} } };
		});
		Assert.equal(result.data.machines.furnace?.queue.size(), queueLimitOf("furnace", 1));
	}

	@Test
	public repairsBrokenMachineFields() {
		const result = load((raw) => {
			raw.machines = { furnace: { queue: "lots", startedAt: 0 / 0, ready: { copper_ingot: -3 } } };
		});
		const furnace = result.data.machines.furnace;
		Assert.equal(furnace?.queue.size(), 0);
		Assert.equal(furnace?.startedAt, 0);
		Assert.equal(furnace?.ready.copper_ingot, 0);
	}

	@Test
	public repairsWarehouseCounts() {
		const result = load((raw) => {
			raw.warehouse = { coal: -1, gold_circuit: 2.5 };
		});
		Assert.equal(result.data.warehouse.coal, 0);
		Assert.equal(result.data.warehouse.gold_circuit, 2);
	}

	@Test
	public higherQueueLevelAllowsALongerQueue() {
		const top = MACHINE_UPGRADES.furnace.queue.size();
		const result = load((raw) => {
			const queue: string[] = [];
			for (let i = 0; i < 500; i++) {
				queue.push("smelt_copper");
			}
			raw.machines = { furnace: { queue, startedAt: 0, ready: {}, speedLevel: 1, queueLevel: top } };
		});
		Assert.equal(result.data.machines.furnace?.queue.size(), queueLimitOf("furnace", top));
		Assert.true((result.data.machines.furnace?.queue.size() ?? 0) > queueLimitOf("furnace", 1));
	}

	@Test
	public brokenUpgradeLevelsAreRepaired() {
		const top = MACHINE_UPGRADES.furnace.speed.size();
		const result = load((raw) => {
			raw.machines = {
				furnace: { queue: [], startedAt: 0, ready: {}, speedLevel: 999, queueLevel: 0 / 0 },
				workbench: { queue: [], startedAt: 0, ready: {}, speedLevel: -3, queueLevel: "high" },
			};
		});
		Assert.equal(result.data.machines.furnace?.speedLevel, top);
		Assert.equal(result.data.machines.furnace?.queueLevel, 1);
		Assert.equal(result.data.machines.workbench?.speedLevel, 1);
		Assert.equal(result.data.machines.workbench?.queueLevel, 1);
	}

	@Test
	public brokenWarehouseLevelIsRepaired() {
		const high = load((raw) => {
			(raw.levels as PlainTable).warehouse = 999;
		});
		Assert.true(high.data.levels.warehouse >= 1 && high.data.levels.warehouse <= 4);
		const low = load((raw) => {
			(raw.levels as PlainTable).warehouse = 0 / 0;
		});
		Assert.equal(low.data.levels.warehouse, 1);
	}

	@Test
	public missingMachineLevelsDefaultToBase() {
		const result = load((raw) => {
			raw.machines = { furnace: { queue: [], startedAt: 0, ready: {} } };
		});
		Assert.equal(result.data.machines.furnace?.speedLevel, 1);
		Assert.equal(result.data.machines.furnace?.queueLevel, 1);
	}
}

export = SanitizeFactoryTests;
