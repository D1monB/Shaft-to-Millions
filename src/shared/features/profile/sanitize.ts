import { BAGS } from "shared/config/bags";
import { MACHINES, MACHINE_IDS, RECIPES, isRecipeId } from "shared/config/machines";
import { ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
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
