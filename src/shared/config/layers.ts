// Layers of the shaft, from the surface down. Names and moods are texts (config/i18n, keys layer.N), our own
// names (see docs/decisions.md); layer 4-5 names are proposals (decisions 027).
// The ore list of a layer is derived from ores.ts, so adding an ore never needs an edit here.
import { ORES, ORE_IDS, OreId } from "./ores";

export const LAYER_COUNT = 5;

/**
 * Deepest record depth in game meters, far deeper than any planned map. Stops a broken sample (falling through
 * the world) from becoming a record. Raising it is a schema bump (see profile/schema.ts): sanitize clamps to it.
 */
export const MAX_DEPTH_METERS = 99_999;

export function oresOfLayer(layer: number): OreId[] {
	return ORE_IDS.filter((id) => ORES[id].layer === layer);
}
