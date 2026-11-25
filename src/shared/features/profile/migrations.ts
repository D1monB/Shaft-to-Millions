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
 * Version 4 replaced the ores (decisions 027). Old prices of everything that was removed, in dollars, so a player is
 * paid for what disappears instead of losing it. Frozen: never edit these tables.
 */
const OLD_PRICES: { readonly [id: string]: number | undefined } = {
	coal: 2,
	copper: 5,
	iron: 9,
	quartz: 25,
	silver: 20,
	gold: 45,
	obsidian: 80,
	cobalt: 150,
	silver_ingot: 65,
	silver_contact: 230,
};

/** Resources that no longer exist after version 4. */
const REMOVED_IN_V4: ReadonlyArray<string> = ["coal", "quartz", "silver", "cobalt", "silver_ingot", "silver_contact"];

/**
 * Money back per queued craft: the whole input value for removed recipes; for kept recipes, the value of the input
 * the recipe no longer takes (coal in smelting, quartz in the circuit).
 */
const RECIPE_REFUND_V4: {
	readonly [id: string]: { readonly machine: string; readonly money: number; readonly removed: boolean } | undefined;
} = {
	smelt_silver: { machine: "furnace", money: 42, removed: true },
	make_contact: { machine: "workbench", money: 145, removed: true },
	smelt_iron: { machine: "furnace", money: 2, removed: false },
	smelt_gold: { machine: "furnace", money: 2, removed: false },
	make_circuit: { machine: "workbench", money: 25, removed: false },
};

/** The longest queue version 3 allowed (top queue level). Entries beyond it were never real crafts. */
const MAX_QUEUE_V3 = 30;

/** The ores each old drill layer may hold after version 4 (only layers 1-3 existed before). */
const LAYER_ORES_V4: { readonly [key: string]: ReadonlyArray<string> | undefined } = {
	layer1: ["copper"],
	layer2: ["iron"],
	layer3: ["gold"],
};

function countOf(value: unknown): number {
	return typeIs(value, "number") && value === value && value > 0 && value < math.huge ? math.floor(value) : 0;
}

/**
 * Most pieces the old game let a player hold, used to cap payouts: a save broken by an old bug (a billion of
 * something) must not turn into money. Bag = the biggest bag, warehouse = the top warehouse level, ready = the longest
 * machine queue. Frozen.
 */
const OLD_MAX_BAG = 800;
const OLD_MAX_WAREHOUSE = 8_000;
const OLD_MAX_READY = 30;

/**
 * Value of the given ids of a count map, counting at most `maxPieces` pieces in total (in the order of `ids`), and
 * removes those ids from the map when `remove` is set.
 */
function payCapped(
	map: unknown,
	ids: ReadonlyArray<string>,
	prices: { readonly [id: string]: number | undefined },
	maxPieces: number,
	remove: boolean,
): number {
	if (!typeIs(map, "table")) {
		return 0;
	}
	const counts = map as PlainTable;
	let money = 0;
	let left = maxPieces;
	for (const id of ids) {
		const pieces = math.min(countOf(counts[id]), left);
		money += pieces * (prices[id] ?? 0);
		left -= pieces;
		if (remove) {
			counts[id] = undefined;
		}
	}
	return money;
}

/** Removes the removed resources from a count map and returns their value (capped at `maxPieces`). */
function cashOutRemoved(map: unknown, maxPieces: number): number {
	return payCapped(map, REMOVED_IN_V4, OLD_PRICES, maxPieces, true);
}

/**
 * Version 4 for one machine: removed recipes leave the queue, every affected craft is paid back. Only crafts that
 * sanitize would have kept are paid (right machine, within the old queue cap), so a corrupt save earns nothing extra.
 */
function cashOutQueue(machineId: unknown, machine: PlainTable): number {
	let money = cashOutRemoved(machine.ready, OLD_MAX_READY);
	if (!typeIs(machine.queue, "table")) {
		return money;
	}
	// Anything that is not a recipe id would be dropped by sanitize anyway.
	const kept: string[] = [];
	let paid = 0;
	for (const recipe of machine.queue as unknown[]) {
		if (!typeIs(recipe, "string")) {
			continue;
		}
		const refund = RECIPE_REFUND_V4[recipe];
		if (refund !== undefined && refund.machine === machineId && paid < MAX_QUEUE_V3) {
			money += refund.money;
			paid += 1;
		}
		if (refund === undefined || !refund.removed) {
			kept.push(recipe);
		}
	}
	machine.queue = kept;
	return money;
}

/** Version 4 for one drill: an ore that left its layer is replaced by the layer ore; the buffer is paid back. */
function cashOutDrill(key: string, drill: PlainTable): number {
	const allowed = LAYER_ORES_V4[key];
	const oreId = drill.oreId;
	if (allowed === undefined || (typeIs(oreId, "string") && allowed.includes(oreId))) {
		return 0;
	}
	const money = countOf(drill.buffer) * (typeIs(oreId, "string") ? (OLD_PRICES[oreId] ?? 0) : 0);
	drill.oreId = allowed[0];
	drill.buffer = 0;
	drill.progress = 0;
	return money;
}

/**
 * Version 5 removed the recipe factory and the warehouse (decisions 027). Everything the player paid for or stored
 * there is paid back at version 4 prices. Frozen: never edit these tables.
 */
const V4_PRICES: { readonly [id: string]: number | undefined } = {
	copper: 5,
	iron: 12,
	gold: 30,
	titanium: 70,
	obsidian: 150,
	etherium: 400,
	copper_ingot: 24,
	iron_ingot: 32,
	gold_ingot: 140,
	copper_wire: 80,
	iron_gear: 105,
	gold_circuit: 520,
};

/** Machine price and the price of each upgrade level (index = level - 1; level 1 is free). */
const V4_MACHINES: {
	readonly [id: string]:
		| { readonly price: number; readonly speed: ReadonlyArray<number>; readonly queue: ReadonlyArray<number> }
		| undefined;
} = {
	furnace: { price: 400, speed: [0, 1_500, 6_000, 25_000], queue: [0, 1_000, 4_000, 15_000] },
	workbench: { price: 3_000, speed: [0, 8_000, 30_000, 120_000], queue: [0, 5_000, 20_000, 80_000] },
};

/** Value of the inputs a queued craft had reserved, and the machine it belongs to. */
const V4_QUEUED: { readonly [id: string]: { readonly machine: string; readonly money: number } | undefined } = {
	smelt_copper: { machine: "furnace", money: 15 },
	smelt_iron: { machine: "furnace", money: 24 },
	smelt_gold: { machine: "furnace", money: 60 },
	make_wire: { machine: "workbench", money: 48 },
	make_gear: { machine: "workbench", money: 64 },
	make_circuit: { machine: "workbench", money: 300 },
};

const V4_WAREHOUSE_LEVELS: ReadonlyArray<number> = [0, 2_000, 10_000, 50_000];

/** Sum of the prices of levels 2..level (what the player paid to reach `level`). Broken levels count as 1. */
function paidForLevel(prices: ReadonlyArray<number>, level: unknown): number {
	const top = countOf(level) > 0 ? math.min(countOf(level), prices.size()) : 1;
	let money = 0;
	for (let i = 1; i < top; i++) {
		money += prices[i];
	}
	return money;
}

/** Every id with a version 4 price, most valuable first (a capped payout keeps the best pieces). Frozen. */
const V4_IDS: ReadonlyArray<string> = [
	"gold_circuit",
	"etherium",
	"obsidian",
	"gold_ingot",
	"iron_gear",
	"copper_wire",
	"titanium",
	"iron_ingot",
	"gold",
	"copper_ingot",
	"iron",
	"copper",
];

/** Value of a count map at version 4 prices, counting at most `maxPieces` pieces. */
function valueAtV4(map: unknown, maxPieces: number): number {
	return payCapped(map, V4_IDS, V4_PRICES, maxPieces, false);
}

/** Version 5 for one owned machine: its price, its upgrades, its finished output and its queued crafts. */
function refundMachineV4(machineId: unknown, machine: unknown): number {
	const def = typeIs(machineId, "string") ? V4_MACHINES[machineId] : undefined;
	if (def === undefined || !typeIs(machine, "table")) {
		return 0;
	}
	const fields = machine as PlainTable;
	let money = def.price + paidForLevel(def.speed, fields.speedLevel) + paidForLevel(def.queue, fields.queueLevel);
	money += valueAtV4(fields.ready, OLD_MAX_READY);
	if (typeIs(fields.queue, "table")) {
		let paid = 0;
		for (const recipe of fields.queue as unknown[]) {
			const queued = typeIs(recipe, "string") ? V4_QUEUED[recipe] : undefined;
			if (queued !== undefined && queued.machine === machineId && paid < MAX_QUEUE_V3) {
				money += queued.money;
				paid += 1;
			}
		}
	}
	return money;
}

/**
 * Version 6 (decisions 031): obsidian and etherium are gone; silver and iridium came. Old ore becomes the new ore
 * with the SAME price at version 6 (obsidian $150 = titanium, etherium $400 = iridium), so nobody loses value.
 * Frozen: never edit this table.
 */
const V6_RENAMED: { readonly [id: string]: string | undefined } = { obsidian: "titanium", etherium: "iridium" };

function renamedOre(id: unknown): unknown {
	return typeIs(id, "string") ? (V6_RENAMED[id] ?? id) : id;
}

/** Moves the counts of renamed ores onto their new id (adding to what is there). Broken counts are left to sanitize. */
function renameCounts(map: unknown): void {
	if (!typeIs(map, "table")) {
		return;
	}
	const counts = map as PlainTable;
	for (const [oldId, newId] of pairs(V6_RENAMED)) {
		const moved = counts[oldId];
		if (moved === undefined) {
			continue;
		}
		const amount = countOf(moved);
		counts[oldId] = undefined;
		counts[newId] = countOf(counts[newId]) + amount;
	}
}

/** Renames ore ids inside a list (the belt intake, a machine queue), keeping the order. */
function renameList(list: unknown): void {
	if (!typeIs(list, "table")) {
		return;
	}
	const items = list as unknown[];
	for (let i = 0; i < items.size(); i++) {
		items[i] = renamedOre(items[i]);
	}
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
	{
		// Version 4 (new ores, decisions 027): removed ores and products are paid out at their old price; a drill on an
		// ore that moved to another layer switches to the layer ore. The bump also raises the layer cap from 3 to 5.
		from: 3,
		apply: (data) => {
			let money = cashOutRemoved(data.bag, OLD_MAX_BAG) + cashOutRemoved(data.warehouse, OLD_MAX_WAREHOUSE);
			if (typeIs(data.machines, "table")) {
				for (const [machineId, machine] of pairs(data.machines as PlainTable)) {
					if (typeIs(machine, "table")) {
						money += cashOutQueue(machineId, machine as PlainTable);
					}
				}
			}
			if (typeIs(data.drills, "table")) {
				for (const [key, drill] of pairs(data.drills as PlainTable)) {
					if (typeIs(key, "string") && typeIs(drill, "table")) {
						money += cashOutDrill(key, drill as PlainTable);
					}
				}
			}
			const before = typeIs(data.money, "number") && data.money === data.money ? data.money : 0;
			data.money = before + money; // sanitize clamps to the money cap afterwards
		},
	},
	{
		// Version 5 (tycoon line, decisions 027): the furnace, the workbench and the warehouse are gone. Their prices,
		// upgrades and contents are paid back; the empty line and lastSeen come from the defaults.
		from: 4,
		apply: (data) => {
			let money = valueAtV4(data.warehouse, OLD_MAX_WAREHOUSE);
			const levels = typeIs(data.levels, "table") ? (data.levels as PlainTable) : undefined;
			money += paidForLevel(V4_WAREHOUSE_LEVELS, levels?.warehouse);
			if (typeIs(data.machines, "table")) {
				for (const [machineId, machine] of pairs(data.machines as PlainTable)) {
					money += refundMachineV4(machineId, machine);
				}
			}
			data.warehouse = undefined;
			data.machines = undefined;
			data.levels = undefined;
			const before = typeIs(data.money, "number") && data.money === data.money ? data.money : 0;
			data.money = before + money; // sanitize clamps to the money cap afterwards
		},
	},
	{
		// Version 6 (decisions 031): obsidian -> titanium, etherium -> iridium everywhere ore ids are saved (same
		// price). Drills follow their layer's ore in sanitize; the bump stops an older server from deleting the new ids.
		from: 5,
		apply: (data) => {
			renameCounts(data.bag);
			if (typeIs(data.line, "table")) {
				const line = data.line as PlainTable;
				renameList(line.intake);
				if (typeIs(line.machines, "table")) {
					for (const machine of line.machines as unknown[]) {
						if (typeIs(machine, "table")) {
							renameList((machine as PlainTable).queue);
						}
					}
				}
			}
			if (typeIs(data.drills, "table")) {
				for (const [, drill] of pairs(data.drills as PlainTable)) {
					if (typeIs(drill, "table")) {
						const fields = drill as PlainTable;
						fields.oreId = renamedOre(fields.oreId);
					}
				}
			}
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
