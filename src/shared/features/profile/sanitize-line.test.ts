import { Assert, Test } from "@rbxts/lunit";
import { BELT_SECONDS_PER_ITEM, HOPPER_CAPACITY, LINE_MACHINES, LINE_UPGRADES } from "shared/config/line";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";

function loadWith(mutate: (raw: PlainTable) => void) {
	const raw = createDefaultProfileData() as unknown as PlainTable;
	mutate(raw);
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`load failed: ${result.reason}`);
	}
	return result;
}

function machine(fields: PlainTable = {}): PlainTable {
	const base: PlainTable = { speed: 1, duplicate: 1, quality: 1, capacity: 1, progress: 0, queue: [] };
	for (const [key, value] of pairs(fields)) {
		base[key as string] = value;
	}
	return base;
}

function repeatOre(ore: string, count: number): string[] {
	const list: string[] = [];
	for (let i = 0; i < count; i++) {
		list.push(ore);
	}
	return list;
}

// The line holds value (queued ore, paid upgrades), so a broken save must be repaired, never crash or inflate.
class SanitizeLineTests {
	@Test
	public newPlayerHasAnEmptyLine() {
		const data = createDefaultProfileData();
		Assert.equal(data.line.machines.size(), 0);
		Assert.equal(data.lastSeen, 0);
	}

	@Test
	public missingOrBrokenLineBecomesEmpty() {
		for (const value of [undefined, "line", 5, { machines: "x" }]) {
			const result = loadWith((raw) => {
				raw.line = value;
			});
			Assert.equal(result.data.line.machines.size(), 0);
		}
	}

	@Test
	public moreMachinesThanTheLineAreCut() {
		const result = loadWith((raw) => {
			const machines: PlainTable[] = [];
			for (let i = 0; i < LINE_MACHINES.size() + 5; i++) {
				machines.push(machine());
			}
			raw.line = { machines };
		});
		Assert.equal(result.data.line.machines.size(), LINE_MACHINES.size());
		Assert.true(result.repairs.includes("line.machines"));
	}

	@Test
	public levelsAndProgressAreClamped() {
		const result = loadWith((raw) => {
			raw.line = {
				machines: [machine({ speed: 99, duplicate: -3, quality: 0 / 0, capacity: math.huge, progress: 1e9 })],
			};
		});
		const repaired = result.data.line.machines[0];
		Assert.equal(repaired.speed, LINE_UPGRADES.speed.size());
		Assert.equal(repaired.duplicate, 1);
		Assert.equal(repaired.quality, 1);
		Assert.true(repaired.capacity >= 1 && repaired.capacity <= LINE_UPGRADES.capacity.size());
		Assert.true(repaired.progress <= LINE_MACHINES[0].seconds);
	}

	@Test
	public queuesKeepOnlyKnownOreWithinTheLimit() {
		const result = loadWith((raw) => {
			raw.line = {
				intake: [...repeatOre("copper", HOPPER_CAPACITY + 50), "coal", 7],
				beltProgress: 99,
				machines: [
					machine({ queue: repeatOre("iron", 50) }),
					machine({ queue: ["iron", "mystery", 3, "gold", ...repeatOre("gold", 500)] }),
				],
			};
		});
		const line = result.data.line;
		const [first, second] = line.machines;
		Assert.equal(line.intake.size(), HOPPER_CAPACITY);
		Assert.true(line.beltProgress <= BELT_SECONDS_PER_ITEM);
		Assert.equal(first.queue.size(), LINE_UPGRADES.capacity[0].value);
		Assert.equal(second.queue.size(), LINE_UPGRADES.capacity[0].value);
		Assert.equal(second.queue[0], "iron");
		Assert.equal(second.queue[1], "gold");
	}

	@Test
	public brokenLastSeenIsZero() {
		for (const value of [-5, 0 / 0, math.huge, "now"]) {
			const result = loadWith((raw) => {
				raw.lastSeen = value;
			});
			Assert.equal(result.data.lastSeen, 0);
		}
	}

	@Test
	public aValidLineLoadsWithoutRepairs() {
		const result = loadWith((raw) => {
			raw.line = {
				intake: ["gold"],
				beltProgress: 0,
				machines: [machine({ speed: 2, queue: ["copper", "iron"] }), machine({ progress: 0.5 })],
			};
			raw.lastSeen = 1_800_000_000;
		});
		Assert.equal(result.repairs.size(), 0);
		Assert.equal(result.data.line.machines[0].speed, 2);
	}
}

export = SanitizeLineTests;
