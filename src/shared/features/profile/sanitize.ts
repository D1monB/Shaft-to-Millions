import { BAGS } from "shared/config/bags";
import { ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { MAX_COUNTER, repairCountMap, repairInteger, repairTable } from "shared/lib/repair";
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

	return repairs;
}
