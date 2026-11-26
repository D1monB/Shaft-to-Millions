// line feature (server): plots, machine prompts, upgrades, the production tick and the offline run.
// Public API of this feature. Other code imports only from this file.
export { homePositionOf, onPlotBuilt, onPlotReleased, setLineBonusProvider, startLineService } from "./line-service";
export type { LineBonus, PlotAreaInfo } from "./line-service";
