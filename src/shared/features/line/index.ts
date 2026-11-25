// line feature (shared): the tycoon production line on the player's plot (decisions 027).
// Public API of this feature. Other code imports only from this file.
export {
	advanceLine,
	advanceOffline,
	applyBuyLineMachine,
	applyLineUpgrade,
	depositOre,
	isLineIdle,
	itemValue,
	lineIncome,
	machineAction,
	newLineState,
	nextLineMachine,
	nextLineUpgrade,
	queueLimit,
	tryBuyLineMachine,
	tryLineUpgrade,
	upgradeValue,
} from "./line";
export type {
	BuyLineMachineResult,
	LineMachineState,
	LineState,
	LineTickResult,
	LineUpgradeResult,
	MachineAction,
	NextLineUpgrade,
	OreValueOf,
	RandomFn,
} from "./line";
export { LINE_DISTANCE, UPGRADE_LINE_MACHINE_REMOTE } from "./network";
