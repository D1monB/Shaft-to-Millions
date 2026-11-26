import { INVENTORY_HARD_LIMIT, ITEMS, ItemKind, isItemId } from "shared/config/items";
import { DRILLS, DRILL_LEVELS, drillKey } from "shared/config/drills";
import { drillBuffer } from "shared/features/drill";
import { LAYER_COUNT, MAX_DEPTH_METERS } from "shared/config/layers";
import { ORES, ORE_IDS, isOreId } from "shared/config/ores";
import {
	BELT_LEVELS,
	BELT_SECONDS_PER_ITEM,
	POLISH_LEVELS,
	SILO_LEVELS,
	LINE_MACHINES,
	LINE_UPGRADES,
	LINE_UPGRADE_TRACKS,
} from "shared/config/line";
import { CHAIN_QUESTS, DAILY_COUNT } from "shared/config/quests";
import { BOOSTER_IDS } from "shared/config/boosters";
import { MAX_REDEEMED_CODES } from "shared/features/promo";
import { MAX_FREE_SPINS, PITY_SPINS } from "shared/config/aura-roll";
import { BUILDINGS, BUILDING_IDS, isBuildingId } from "shared/config/base";
import { MAX_BUILDERS } from "shared/features/base";
import { isLanguage } from "shared/features/i18n";
import { findDaily } from "shared/features/quests";
import { MAX_REMEMBERED_PURCHASES } from "shared/features/chests";
import { GEAR_SLOTS, findGear, starterOf } from "shared/features/upgrades";
import { MAX_COUNTER, repairCountMap, repairInteger, repairNumber, repairTable } from "shared/lib/repair";
import { PlainTable } from "shared/lib/tables";

/**
 * Forces known fields into their valid ranges and types. Runs after migration, before the data is used.
 * Returns the paths it had to repair, so the caller can log them (an exploit or a bug may be behind it).
 * Unknown keys are left alone.
 * Level caps come from the config arrays (gear, line upgrades): adding a level there raises the cap, which is a schema bump
 * (see schema.ts) so an older server does not clamp the new level away.
 */
export function sanitize(data: PlainTable): string[] {
	const repairs: string[] = [];

	repairInteger(data, "money", 0, MAX_COUNTER, 0, "money", repairs);
	repairInteger(data, "crystals", 0, MAX_COUNTER, 0, "crystals", repairs);

	const stats = repairTable(data, "stats", "stats", repairs);
	repairInteger(stats, "totalEarned", 0, MAX_COUNTER, 0, "stats.totalEarned", repairs);
	repairInteger(stats, "oresMined", 0, MAX_COUNTER, 0, "stats.oresMined", repairs);

	repairCountMap(data, "bag", ORE_IDS, "bag", repairs);

	repairInteger(data, "deepestLayer", 1, LAYER_COUNT, 1, "deepestLayer", repairs);
	repairInteger(data, "deepestMeters", 0, MAX_DEPTH_METERS, 0, "deepestMeters", repairs);
	repairGear(data, repairs);
	repairDrills(data, repairs);
	repairInventory(data, repairs);
	repairEquipped(data, repairs);
	repairPurchaseIds(data, repairs);
	repairLine(data, repairs);
	// An infinite time is broken, not "far future": clamping it to the cap would block offline income for decades.
	if (data.lastSeen === math.huge) {
		data.lastSeen = 0;
		repairs.push("lastSeen");
	}
	repairNumber(data, "lastSeen", 0, MAX_TIMESTAMP, 0, "lastSeen", repairs);
	// Only one of our languages or "" (automatic); anything else is reset to automatic.
	if (data.language !== "" && !isLanguage(data.language)) {
		data.language = "";
		repairs.push("language");
	}
	if (!typeIs(data.soundOn, "boolean")) {
		data.soundOn = true;
		repairs.push("soundOn");
	}
	repairQuests(data, repairs);
	repairBase(data, repairs);
	// Anything but a real true is no developer role.
	if (!typeIs(data.devRole, "boolean")) {
		data.devRole = false;
		repairs.push("devRole");
	}
	repairRedeemed(data, repairs);
	const raid = repairTable(data, "raid", "raid", repairs);
	repairInteger(raid, "week", 0, MAX_DAY, 0, "raid.week", repairs);
	repairNumber(raid, "best", 0, MAX_COUNTER, 0, "raid.best", repairs);
	repairNumber(raid, "startedAt", 0, MAX_TIMESTAMP, 0, "raid.startedAt", repairs);
	const auraRoll = repairTable(data, "auraRoll", "auraRoll", repairs);
	repairInteger(auraRoll, "spins", 0, MAX_FREE_SPINS, 0, "auraRoll.spins", repairs);
	repairNumber(auraRoll, "spinAt", 0, MAX_TIMESTAMP, 0, "auraRoll.spinAt", repairs);
	repairInteger(auraRoll, "pity", 0, PITY_SPINS, 0, "auraRoll.pity", repairs);
	const boosts = repairTable(data, "boosts", "boosts", repairs);
	for (const id of BOOSTER_IDS) {
		repairNumber(boosts, id, 0, MAX_TIMESTAMP, 0, `boosts.${id}`, repairs);
	}

	return repairs;
}

/** Far above the number of gear items in the game; only stops a save from growing without end. */
const MAX_OWNED_GEAR = 200;

/**
 * Gear: owned ids are unique strings and always include the starters. Unknown ids are kept (an item from a newer
 * server must not be taken away). An equipped slot must hold an owned item that is not known to be of another slot;
 * otherwise it falls back to the starter.
 */
function repairGear(data: PlainTable, repairs: string[]): void {
	const gear = repairTable(data, "gear", "gear", repairs);
	const raw = gear.owned;
	const owned: string[] = [];
	if (typeIs(raw, "table")) {
		for (const id of raw as unknown[]) {
			if (typeIs(id, "string") && id.size() <= 64 && !owned.includes(id) && owned.size() < MAX_OWNED_GEAR) {
				owned.push(id);
			}
		}
	}
	let changed = !typeIs(raw, "table") || owned.size() !== (raw as unknown[]).size();
	for (const slot of GEAR_SLOTS) {
		if (!owned.includes(starterOf(slot))) {
			owned.push(starterOf(slot));
			changed = true;
		}
	}
	if (changed) {
		repairs.push("gear.owned");
	}
	gear.owned = owned;

	const equipped = repairTable(gear, "equipped", "gear.equipped", repairs);
	for (const slot of GEAR_SLOTS) {
		const id = equipped[slot];
		const known = findGear(id);
		if (!typeIs(id, "string") || !owned.includes(id) || (known !== undefined && known.slot !== slot)) {
			equipped[slot] = starterOf(slot);
			repairs.push(`gear.equipped.${slot}`);
		}
	}
}

// Latest sane unix time we accept (year ~2100). Anything later is a corrupted timestamp.
const MAX_TIMESTAMP = 4_102_444_800;

/**
 * The tycoon line: the intake (known ores, at most HOPPER_CAPACITY), at most one entry per machine in the config,
 * levels within each track, progress within the machine time, queues of known ores within the queue limit of the
 * machine's own capacity level.
 */
function repairLine(data: PlainTable, repairs: string[]): void {
	const line = repairTable(data, "line", "line", repairs);
	repairInteger(line, "siloLevel", 1, SILO_LEVELS.size(), 1, "line.siloLevel", repairs);
	repairInteger(line, "polishLevel", 1, POLISH_LEVELS.size(), 1, "line.polishLevel", repairs);
	const hopper = SILO_LEVELS[(line.siloLevel as number) - 1].value;
	line.intake = repairOreList(line.intake, hopper, "line.intake", repairs);
	repairNumber(line, "beltProgress", 0, BELT_SECONDS_PER_ITEM, 0, "line.beltProgress", repairs);
	repairInteger(line, "beltLevel", 1, BELT_LEVELS.size(), 1, "line.beltLevel", repairs);
	const raw = line.machines;
	const machines: PlainTable[] = [];
	if (typeIs(raw, "table")) {
		for (const entry of raw as unknown[]) {
			if (machines.size() >= LINE_MACHINES.size()) {
				break;
			}
			// A hole in the array would shift every later machine; stop at the first non-table.
			if (!typeIs(entry, "table")) {
				break;
			}
			machines.push(entry as PlainTable);
		}
	}
	if (!typeIs(raw, "table") || machines.size() !== (raw as unknown[]).size()) {
		repairs.push("line.machines");
	}
	line.machines = machines;
	machines.forEach((machine, index) => {
		const path = `line.machines.${index}`;
		for (const track of LINE_UPGRADE_TRACKS) {
			repairInteger(machine, track, 1, LINE_UPGRADES[track].size(), 1, `${path}.${track}`, repairs);
		}
		repairNumber(machine, "progress", 0, LINE_MACHINES[index].seconds, 0, `${path}.progress`, repairs);
		const limit = LINE_UPGRADES.capacity[(machine.capacity as number) - 1].value;
		machine.queue = repairOreList(machine.queue, limit, `${path}.queue`, repairs);
	});
}

/** The base (decision 063): levels in range, at most one job per known building, 1..MAX builders. */
function repairBase(data: PlainTable, repairs: string[]): void {
	const base = repairTable(data, "base", "base", repairs);
	const levels = repairTable(base, "levels", "base.levels", repairs);
	for (const id of BUILDING_IDS) {
		repairInteger(levels, id, 0, BUILDINGS[id].levels.size(), 0, `base.levels.${id}`, repairs);
	}
	repairInteger(base, "builders", 1, MAX_BUILDERS, 1, "base.builders", repairs);
	const raw = base.jobs;
	const jobs: PlainTable[] = [];
	const seen = new Set<string>();
	if (typeIs(raw, "table")) {
		for (const entry of raw as unknown[]) {
			if (jobs.size() >= MAX_BUILDERS || !typeIs(entry, "table")) {
				continue;
			}
			const job = entry as PlainTable;
			const id = job.id;
			if (!isBuildingId(id) || seen.has(id) || !typeIs(job.finishAt, "number")) {
				continue;
			}
			seen.add(id);
			repairNumber(job, "finishAt", 0, MAX_TIMESTAMP, 0, "base.jobs.finishAt", repairs);
			jobs.push(job);
		}
	}
	if (!typeIs(raw, "table") || jobs.size() !== (raw as unknown[]).size()) {
		repairs.push("base.jobs");
	}
	base.jobs = jobs;
}

/** Used promo codes: short strings only, at most MAX_REDEEMED_CODES. */
function repairRedeemed(data: PlainTable, repairs: string[]): void {
	const raw = data.redeemedCodes;
	const clean: string[] = [];
	if (typeIs(raw, "table")) {
		for (const code of raw as unknown[]) {
			if (typeIs(code, "string") && code.size() <= 24 && clean.size() < MAX_REDEEMED_CODES) {
				clean.push(code);
			}
		}
	}
	if (!typeIs(raw, "table") || clean.size() !== (raw as unknown[]).size()) {
		repairs.push("redeemedCodes");
	}
	data.redeemedCodes = clean;
}

/** A day number far in the future (year ~2300); only stops a broken save from blocking quests for ever. */
const MAX_DAY = 120_000;

/** Quests (decision 055): known daily ids only, counters in range, the chain index inside the chain. */
function repairQuests(data: PlainTable, repairs: string[]): void {
	const quests = repairTable(data, "quests", "quests", repairs);
	for (const key of ["day", "loginDay", "streakClaimedDay"]) {
		repairInteger(quests, key, 0, MAX_DAY, 0, `quests.${key}`, repairs);
	}
	repairInteger(quests, "streak", 0, MAX_DAY, 0, "quests.streak", repairs);
	repairInteger(quests, "chain", 0, CHAIN_QUESTS.size(), 0, "quests.chain", repairs);
	repairNumber(quests, "chainCount", 0, MAX_COUNTER, 0, "quests.chainCount", repairs);
	if (!typeIs(quests.allDoneClaimed, "boolean")) {
		quests.allDoneClaimed = false;
		repairs.push("quests.allDoneClaimed");
	}
	const raw = quests.daily;
	const clean: PlainTable[] = [];
	if (typeIs(raw, "table")) {
		for (const entry of raw as unknown[]) {
			if (clean.size() >= DAILY_COUNT || !typeIs(entry, "table")) {
				continue;
			}
			const row = entry as PlainTable;
			if (!typeIs(row.id, "string") || findDaily(row.id) === undefined) {
				continue;
			}
			repairNumber(row, "count", 0, MAX_COUNTER, 0, "quests.daily.count", repairs);
			if (!typeIs(row.claimed, "boolean")) {
				row.claimed = false;
				repairs.push("quests.daily.claimed");
			}
			clean.push(row);
		}
	}
	if (!typeIs(raw, "table") || clean.size() !== (raw as unknown[]).size()) {
		repairs.push("quests.daily");
	}
	quests.daily = clean;
}

/** A list of known ore ids, cut to `limit` entries. */
function repairOreList(raw: unknown, limit: number, path: string, repairs: string[]): string[] {
	const clean: string[] = [];
	if (typeIs(raw, "table")) {
		for (const ore of raw as unknown[]) {
			if (isOreId(ore) && clean.size() < limit) {
				clean.push(ore);
			}
		}
	}
	if (!typeIs(raw, "table") || clean.size() !== (raw as unknown[]).size()) {
		repairs.push(path);
	}
	return clean;
}

/**
 * Each owned drill: a known ore of THAT layer, sane timestamps and a buffer within capacity.
 * A drill with an ore from another layer is reset to the layer's first ore instead of being deleted.
 */
function repairDrills(data: PlainTable, repairs: string[]): void {
	const drills = repairTable(data, "drills", "drills", repairs);
	for (let layer = 1; layer <= LAYER_COUNT; layer++) {
		const key = drillKey(layer);
		const def = DRILLS[layer];
		if (drills[key] === undefined || def === undefined) {
			continue;
		}
		const path = "drills." + key;
		const drill = repairTable(drills, key, path, repairs);
		const oreId = drill.oreId;
		// A drill may only sit on a drillable ore of its own layer (iridium is mined by hand, decisions 031).
		if (!isOreId(oreId) || ORES[oreId].layer !== layer || ORES[oreId].drillable === false) {
			drill.oreId = ORE_IDS.find((id) => ORES[id].layer === layer && ORES[id].drillable !== false) ?? "copper";
			repairs.push(path + ".oreId");
		}
		repairNumber(drill, "lastTick", 0, MAX_TIMESTAMP, 0, path + ".lastTick", repairs);
		repairNumber(drill, "progress", 0, 1e6, 0, path + ".progress", repairs);
		repairInteger(drill, "level", 1, DRILL_LEVELS.size(), 1, path + ".level", repairs);
		repairInteger(drill, "buffer", 0, drillBuffer(layer, drill.level as number), 0, path + ".buffer", repairs);
	}
}

/** "i" followed by 1-12 digits: always parseable and always below MAX_COUNTER. */
function isValidUid(uid: unknown): uid is string {
	return typeIs(uid, "string") && string.match(uid, "^i%d%d?%d?%d?%d?%d?%d?%d?%d?%d?%d?%d?$")[0] !== undefined;
}

/**
 * Inventory: only known items, unique uids, at most the hard limit. nextUid is pushed past every uid in use,
 * so a repaired save can never hand out a uid twice (which would let one pet be equipped as two).
 */
function repairInventory(data: PlainTable, repairs: string[]): void {
	const raw = data.inventory;
	const clean: Array<{ uid: string; item: string }> = [];
	const seen = new Set<string>();
	let highest = 0;
	if (typeIs(raw, "table")) {
		for (const entry of raw as unknown[]) {
			if (!typeIs(entry, "table")) {
				continue;
			}
			const { uid, item } = entry as { uid?: unknown; item?: unknown };
			if (!isValidUid(uid) || seen.has(uid) || !isItemId(item)) {
				continue;
			}
			if (clean.size() >= INVENTORY_HARD_LIMIT) {
				break;
			}
			seen.add(uid);
			clean.push({ uid, item });
			highest = math.max(highest, tonumber(uid.sub(2)) ?? 0);
		}
	}
	if (!typeIs(raw, "table") || clean.size() !== (raw as unknown[]).size()) {
		repairs.push("inventory");
	}
	data.inventory = clean;
	repairInteger(data, "nextUid", 1, MAX_COUNTER, 1, "nextUid", repairs);
	if ((data.nextUid as number) <= highest) {
		data.nextUid = highest + 1;
		repairs.push("nextUid");
	}
}

function repairPurchaseIds(data: PlainTable, repairs: string[]): void {
	const raw = data.purchaseIds;
	const clean: string[] = [];
	if (typeIs(raw, "table")) {
		for (const id of raw as unknown[]) {
			if (typeIs(id, "string") && id.size() <= 64 && clean.size() < MAX_REMEMBERED_PURCHASES) {
				clean.push(id);
			}
		}
	}
	if (!typeIs(raw, "table") || clean.size() !== (raw as unknown[]).size()) {
		repairs.push("purchaseIds");
	}
	data.purchaseIds = clean;
}

const MAX_EQUIPPED_PETS = 3;

/**
 * Equipped slots may only point at owned items of the right kind; pets are unique and at most three.
 * Runs after repairInventory, so the inventory is already clean.
 */
function repairEquipped(data: PlainTable, repairs: string[]): void {
	const kindOf = new Map<string, ItemKind>();
	for (const entry of data.inventory as Array<{ uid: string; item: keyof typeof ITEMS }>) {
		kindOf.set(entry.uid, ITEMS[entry.item].kind);
	}
	const equipped = repairTable(data, "equipped", "equipped", repairs);
	for (const [slot, kind] of [
		["speedAura", "speedAura"],
		["pickaxeAura", "pickaxeAura"],
	] as const) {
		const uid = equipped[slot];
		if (uid !== undefined && (!typeIs(uid, "string") || kindOf.get(uid) !== kind)) {
			equipped[slot] = undefined;
			repairs.push(`equipped.${slot}`);
		}
	}
	const raw = equipped.pets;
	const pets: string[] = [];
	if (typeIs(raw, "table")) {
		for (const uid of raw as unknown[]) {
			if (
				typeIs(uid, "string") &&
				kindOf.get(uid) === "pet" &&
				!pets.includes(uid) &&
				pets.size() < MAX_EQUIPPED_PETS
			) {
				pets.push(uid);
			}
		}
	}
	if (!typeIs(raw, "table") || pets.size() !== (raw as unknown[]).size()) {
		repairs.push("equipped.pets");
	}
	equipped.pets = pets;
}
