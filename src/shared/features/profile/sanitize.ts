import { BAGS } from "shared/config/bags";
import { INVENTORY_HARD_LIMIT, ITEMS, ItemKind, isItemId } from "shared/config/items";
import { MACHINES, MACHINE_IDS, RECIPES, isRecipeId } from "shared/config/machines";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import { DRILLS, drillKey } from "shared/config/drills";
import { LAYER_COUNT } from "shared/config/layers";
import { ORES, ORE_IDS, isOreId } from "shared/config/ores";
import { RESOURCE_IDS } from "shared/config/resources";
import { MAX_COUNTER, repairCountMap, repairInteger, repairNumber, repairTable } from "shared/lib/repair";
import { PlainTable } from "shared/lib/tables";

/**
 * Forces known fields into their valid ranges and types. Runs after migration, before the data is used.
 * Returns the paths it had to repair, so the caller can log them (an exploit or a bug may be behind it).
 * Unknown keys are left alone.
 * Level caps come from the config arrays: adding a level there raises the cap, which is a schema bump
 * (see schema.ts) so an older server does not clamp the new level away.
 */
export function sanitize(data: PlainTable): string[] {
	const repairs: string[] = [];

	repairInteger(data, "money", 0, MAX_COUNTER, 0, "money", repairs);

	const stats = repairTable(data, "stats", "stats", repairs);
	repairInteger(stats, "totalEarned", 0, MAX_COUNTER, 0, "stats.totalEarned", repairs);
	repairInteger(stats, "oresMined", 0, MAX_COUNTER, 0, "stats.oresMined", repairs);

	repairCountMap(data, "bag", ORE_IDS, "bag", repairs);

	const levels = repairTable(data, "levels", "levels", repairs);
	repairInteger(levels, "pickaxe", 1, PICKAXES.size(), 1, "levels.pickaxe", repairs);
	repairInteger(levels, "bag", 1, BAGS.size(), 1, "levels.bag", repairs);
	repairInteger(levels, "shoes", 1, SHOES.size(), 1, "levels.shoes", repairs);
	repairInteger(data, "deepestLayer", 1, LAYER_COUNT, 1, "deepestLayer", repairs);
	repairDrills(data, repairs);
	repairInventory(data, repairs);
	repairEquipped(data, repairs);
	repairPurchaseIds(data, repairs);

	repairCountMap(data, "warehouse", RESOURCE_IDS, "warehouse", repairs);
	repairMachines(data, repairs);

	return repairs;
}

// Latest sane unix time we accept (year ~2100). Anything later is a corrupted timestamp.
const MAX_TIMESTAMP = 4_102_444_800;

/**
 * Each owned machine: a queue of known recipes for THAT machine (capped at its limit), a sane start time
 * and finished output counts. Unknown machine ids are left alone (newer server data).
 */
function repairMachines(data: PlainTable, repairs: string[]): void {
	const machines = repairTable(data, "machines", "machines", repairs);
	for (const machineId of MACHINE_IDS) {
		const raw = machines[machineId];
		if (raw === undefined) {
			continue;
		}
		const path = `machines.${machineId}`;
		const machine = repairTable(machines, machineId, path, repairs);
		const queue = machine.queue;
		const cleanQueue: string[] = [];
		if (typeIs(queue, "table")) {
			for (const recipeId of queue as unknown[]) {
				if (
					isRecipeId(recipeId) &&
					RECIPES[recipeId].machine === machineId &&
					cleanQueue.size() < MACHINES[machineId].queueLimit
				) {
					cleanQueue.push(recipeId);
				}
			}
		}
		if (!typeIs(queue, "table") || cleanQueue.size() !== (queue as unknown[]).size()) {
			repairs.push(`${path}.queue`);
		}
		machine.queue = cleanQueue;
		repairNumber(machine, "startedAt", 0, MAX_TIMESTAMP, 0, `${path}.startedAt`, repairs);
		repairCountMap(machine, "ready", RESOURCE_IDS, `${path}.ready`, repairs);
	}
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
		if (!isOreId(oreId) || ORES[oreId].layer !== layer) {
			drill.oreId = ORE_IDS.find((id) => ORES[id].layer === layer) ?? "coal";
			repairs.push(path + ".oreId");
		}
		repairNumber(drill, "lastTick", 0, MAX_TIMESTAMP, 0, path + ".lastTick", repairs);
		repairNumber(drill, "progress", 0, 1e6, 0, path + ".progress", repairs);
		repairInteger(drill, "buffer", 0, def.bufferCapacity, 0, path + ".buffer", repairs);
	}
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
			if (!typeIs(uid, "string") || uid.size() > 16 || seen.has(uid) || !isItemId(item)) {
				continue;
			}
			if (clean.size() >= INVENTORY_HARD_LIMIT) {
				break;
			}
			seen.add(uid);
			clean.push({ uid, item });
			const numeric = tonumber(uid.sub(2));
			if (numeric !== undefined && numeric > highest) {
				highest = numeric;
			}
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
