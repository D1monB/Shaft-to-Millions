import { INVENTORY_HARD_LIMIT, ITEMS, ItemKind, isItemId } from "shared/config/items";
import { DRILLS, drillKey } from "shared/config/drills";
import { LAYER_COUNT, MAX_DEPTH_METERS } from "shared/config/layers";
import { ORES, ORE_IDS, isOreId } from "shared/config/ores";
import {
	BELT_LEVELS,
	BELT_SECONDS_PER_ITEM,
	HOPPER_CAPACITY,
	LINE_MACHINES,
	LINE_UPGRADES,
	LINE_UPGRADE_TRACKS,
} from "shared/config/line";
import { isLanguage } from "shared/features/i18n";
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
	line.intake = repairOreList(line.intake, HOPPER_CAPACITY, "line.intake", repairs);
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
		repairInteger(drill, "buffer", 0, def.bufferCapacity, 0, path + ".buffer", repairs);
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
			if (typeIs(id, "string") && id.size() <= 64 && clean.size() < 100) {
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
