import { PlainTable, deepCopy } from "shared/lib/tables";

/**
 * Version 3 replaced gear levels with owned items. Each old level becomes the new item closest to it
 * (never weaker), so nobody loses progress. Index 0 = level 1. Frozen: never edit these lists.
 */
const OLD_GEAR_LEVELS: { readonly [slot: string]: ReadonlyArray<string> } = {
	pickaxe: ["pickaxe_wood", "pickaxe_iron", "pickaxe_gold", "pickaxe_drill", "pickaxe_plasma"],
	bag: ["bag_sack", "bag_leather", "bag_miner", "bag_reinforced", "bag_cargo", "bag_gravity"],
	shoes: ["shoes_old", "shoes_miner", "shoes_light", "shoes_spring", "shoes_jet", "shoes_gravity"],
};

/** The item for an old saved level; a broken level counts as level 1. */
function itemForOldLevel(slot: string, level: unknown): string {
	const items = OLD_GEAR_LEVELS[slot];
	// Infinity is clamped to the top item (never weaker); NaN, non-numbers and levels below 1 count as level 1.
	const valid = typeIs(level, "number") && level === level && level >= 1;
	const index = valid ? math.clamp(math.floor(level) - 1, 0, items.size() - 1) : 0;
	return items[index];
}

/**
 * Upgrades saved data from version `from` to `from + 1`.
 * `apply` changes the table it receives (always a copy, never the live save).
 */
export interface Migration {
	readonly from: number;
	readonly apply: (data: PlainTable) => void;
}

/**
 * One entry per schema bump, in order: from 1, 2, 3 ...
 * Version 1 is the first release, so there is nothing to migrate yet.
 * Example for later (bumping CURRENT_SCHEMA_VERSION to 2):
 *   { from: 1, apply: (data) => { data.gold = data.coins; data.coins = undefined; } }
 */
export const MIGRATIONS: ReadonlyArray<Migration> = [
	{
		// Version 2 (machine upgrades): adds levels.warehouse and each machine's speedLevel/queueLevel, and raises the
		// machine queue cap. The bump itself matters: an older server must refuse a v2 save instead of clamping the
		// longer queue and deleting crafts.
		from: 1,
		apply: (data) => {
			const levels = data.levels;
			if (typeIs(levels, "table") && (levels as PlainTable).warehouse === undefined) {
				(levels as PlainTable).warehouse = 1;
			}
			const machines = data.machines;
			if (typeIs(machines, "table")) {
				for (const [, machine] of pairs(machines as PlainTable)) {
					if (typeIs(machine, "table")) {
						const fields = machine as PlainTable;
						fields.speedLevel = fields.speedLevel ?? 1;
						fields.queueLevel = fields.queueLevel ?? 1;
					}
				}
			}
		},
	},
	{
		// Version 3 (gear catalogue): levels.pickaxe/bag/shoes become gear.owned + gear.equipped.
		from: 2,
		apply: (data) => {
			const levels = typeIs(data.levels, "table") ? (data.levels as PlainTable) : {};
			const owned: string[] = [];
			const equipped: PlainTable = {};
			for (const slot of ["pickaxe", "bag", "shoes"]) {
				const starter = OLD_GEAR_LEVELS[slot][0];
				const item = itemForOldLevel(slot, levels[slot]);
				owned.push(starter);
				if (item !== starter) {
					owned.push(item);
				}
				equipped[slot] = item;
				levels[slot] = undefined;
			}
			data.levels = levels;
			data.gear = { owned, equipped };
		},
	},
];

export type MigrationFailure = "invalid-version" | "future-version" | "migration-failed";

export type MigrationResult = { ok: true; data: PlainTable } | { ok: false; reason: MigrationFailure; detail?: string };

function isValidVersion(value: unknown): value is number {
	// `value === value` is false only for NaN. Infinity fails the floor check below it.
	return typeIs(value, "number") && value === value && value >= 1 && value < math.huge && math.floor(value) === value;
}

/**
 * Brings raw saved data to `targetVersion`. The input is never modified:
 * if any step fails the caller still has the original, untouched save.
 */
export function migrate(raw: PlainTable, migrations: ReadonlyArray<Migration>, targetVersion: number): MigrationResult {
	const version = raw.schemaVersion;
	if (!isValidVersion(version)) {
		return { ok: false, reason: "invalid-version" };
	}
	if (version > targetVersion) {
		// Saved by a newer server (e.g. during a rolling update). Do not touch it, we would lose data.
		return { ok: false, reason: "future-version" };
	}

	const data = deepCopy(raw);
	for (let current = version; current < targetVersion; current++) {
		const step = migrations.find((migration) => migration.from === current);
		if (step === undefined) {
			return { ok: false, reason: "migration-failed", detail: `no migration from version ${current}` };
		}
		try {
			step.apply(data);
		} catch (err) {
			return { ok: false, reason: "migration-failed", detail: `from version ${current}: ${tostring(err)}` };
		}
		data.schemaVersion = current + 1;
	}
	return { ok: true, data };
}

/**
 * True when `migrations` has exactly one step for every version from 1 up to `targetVersion - 1`.
 * A test runs this on the real list, so bumping CURRENT_SCHEMA_VERSION without a migration fails CI.
 */
export function isMigrationChainComplete(migrations: ReadonlyArray<Migration>, targetVersion: number): boolean {
	if (migrations.size() !== targetVersion - 1) {
		return false;
	}
	for (let version = 1; version < targetVersion; version++) {
		const matches = migrations.filter((migration) => migration.from === version);
		if (matches.size() !== 1) {
			return false;
		}
	}
	return true;
}
