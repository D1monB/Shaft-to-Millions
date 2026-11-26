// drill feature (shared): auto drills with a conveyor to the warehouse. Pure logic, unit tested.
// Public API of this feature. Other code imports only from this file.
export {
	advanceDrill,
	canDrillOre,
	deliverDrill,
	drillBuffer,
	drillLevelOf,
	isDrillUnlocked,
	newDrillState,
	nextDrillLevelPrice,
	secondsPerPiece,
	selectDrillOre,
	tryUpgradeDrill,
} from "./drill";
export type { DrillState, DrillUpgradeResult } from "./drill";
export { BUY_DRILL_REMOTE, DRILL_DISTANCE, SELECT_DRILL_ORE_REMOTE, UPGRADE_DRILL_REMOTE } from "./network";
