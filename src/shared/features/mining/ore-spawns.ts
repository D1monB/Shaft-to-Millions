// Which ore grows at one of the map author's ore spawn points (decision 034). Pure, so it runs under Lune.
// Folder TierN holds the points of layer N; each layer has one main ore, and ores marked `nearPortal` (iridium)
// take the points of their layer that lie near the portal instead.
import { ORES, ORE_IDS, OreId } from "shared/config/ores";
import { PORTAL_ORE_RADIUS } from "./tuning";

function isFiniteNumber(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

/** "Tier3" -> 3; anything else -> undefined. */
export function tierOf(folderName: string): number | undefined {
	const [digits] = folderName.match("^Tier(%d+)$");
	const tier = typeIs(digits, "string") ? tonumber(digits) : undefined;
	return tier !== undefined && tier >= 1 ? tier : undefined;
}

/**
 * The ore for a spawn point of layer `tier`, `portalDistance` studs from the portal (undefined when the map has no
 * portal). Undefined when the layer has no ore.
 */
export function oreForSpawn(tier: number, portalDistance: number | undefined): OreId | undefined {
	if (!isFiniteNumber(tier)) {
		return undefined;
	}
	const ores = ORE_IDS.filter((id) => ORES[id].layer === tier);
	const nearPortal = isFiniteNumber(portalDistance) && portalDistance >= 0 && portalDistance <= PORTAL_ORE_RADIUS;
	const portalOre = ores.find((id) => ORES[id].nearPortal === true);
	if (nearPortal && portalOre !== undefined) {
		return portalOre;
	}
	return ores.find((id) => ORES[id].nearPortal !== true);
}
