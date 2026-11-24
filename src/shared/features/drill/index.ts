// drill feature (shared): auto drills with a conveyor to the warehouse. Pure logic, unit tested.
// Public API of this feature. Other code imports only from this file.
export {
	advanceDrill,
	canDrillOre,
	deliverDrill,
	isDrillUnlocked,
	newDrillState,
	secondsPerPiece,
	selectDrillOre,
} from "./drill";
export type { DrillState } from "./drill";
export { BUY_DRILL_REMOTE, DRILL_DISTANCE, SELECT_DRILL_ORE_REMOTE } from "./network";
