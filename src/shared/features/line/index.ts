// line feature (shared): the tycoon production line on the player's plot (decisions 027).
// Public API of this feature. Other code imports only from this file.
export {
	advanceLine,
	advanceOffline,
	applyBuyLineMachine,
	applyLineUpgrade,
	depositOre,
	intakeRoom,
	isLineIdle,
	itemValue,
	lineIncome,
	MAX_LINE_MOVES,
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
	LineMove,
	LineState,
	LineTickResult,
	LineUpgradeResult,
	MachineAction,
	NextLineUpgrade,
	OreValueOf,
	RandomFn,
} from "./line";
export {
	BELT_PATH_VALUE,
	ITEM_TEMPLATES_FOLDER,
	LINE_DISTANCE,
	LINE_FLOW_REMOTE,
	UPGRADE_LINE_MACHINE_REMOTE,
} from "./network";
export { gapAround, splitStretch } from "./belt-gap";
export type { Span } from "./belt-gap";
export { nearestIndex, orderChain, parseBeltPath, pathBetween, routeFor } from "./belt-path";
export type { BeltRoute, StoredBeltPath, Vec3 } from "./belt-path";
