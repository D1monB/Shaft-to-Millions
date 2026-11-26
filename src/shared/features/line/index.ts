// line feature (shared): the tycoon production line on the player's plot (decisions 027).
// Public API of this feature. Other code imports only from this file.
export {
	advanceLine,
	advanceOffline,
	applyBuyLineMachine,
	applyLineUpgrade,
	BELT_TRACK_FIELD,
	beltSpeed,
	beltTrackLevels,
	beltTrackNow,
	hopperCapacity,
	depositOre,
	intakeRoom,
	isLineIdle,
	itemValue,
	lineIncome,
	MAX_LINE_MOVES,
	machineAction,
	newLineState,
	nextLineMachine,
	nextBeltLevel,
	nextLineUpgrade,
	queueLimit,
	tryBeltUpgrade,
	tryBuyLineMachine,
	tryLineUpgrade,
	upgradeValue,
} from "./line";
export type {
	BeltUpgradeResult,
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
	LABEL_HEIGHT_ATTRIBUTE,
	LINE_DISTANCE,
	LINE_FLOW_REMOTE,
	BELT_POINT_TAG,
	UPGRADE_BELT_REMOTE,
	UPGRADE_LINE_MACHINE_REMOTE,
	UPGRADE_POINT_TAG,
} from "./network";
export { formatUpgradeValue, machineGauge, upgradeRows } from "./line-view";
export type { GaugeStatus, MachineGauge, UpgradeRow } from "./line-view";
export { gapAround, splitStretch } from "./belt-gap";
export type { Span } from "./belt-gap";
export type { BeltPiece } from "./belt-path";
export {
	chainPoints,
	cornerPiece,
	nearestIndex,
	orderPieces,
	parseBeltPath,
	pathBetween,
	routeFor,
	straightPiece,
} from "./belt-path";
export type { BeltRoute, StoredBeltPath, Vec3 } from "./belt-path";
