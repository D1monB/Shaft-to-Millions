// world feature (server): ore blocks on the map author's spawn points, and Studio-only grey-box placeholders for
// tags the real map does not provide yet.
// Public API of this feature. Other code imports only from this file.
export {
	buildBasePlaceholders,
	buildChestPlaceholders,
	buildLayerPlaceholders,
	buildOreRow,
	buildPlotPlaceholders,
	makePlaceholder,
	needsPlaceholders,
} from "./placeholders";
export { spawnMapOre } from "./ore-spawns";
