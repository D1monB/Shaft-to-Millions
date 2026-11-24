// Depth progress. A layer opens when the player reaches its camp, and only one step at a time:
// a player who teleports (exploit) straight to layer 3 does not skip layer 2.
import { LAYER_COUNT } from "shared/config/layers";

/** The new deepest layer after reaching the camp of `layer`, or undefined if nothing changes. */
export function reachLayer(deepestLayer: number, layer: number): number | undefined {
	if (layer !== layer || math.floor(layer) !== layer || layer < 1 || layer > LAYER_COUNT) {
		return undefined;
	}
	if (layer === deepestLayer + 1) {
		return layer;
	}
	return undefined;
}
