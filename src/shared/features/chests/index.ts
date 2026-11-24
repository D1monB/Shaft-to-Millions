// chests feature (shared): reward odds, the roll, dollar-opening checks, inventory and receipt bookkeeping.
// Public API of this feature. Other code imports only from this file.
export {
	MAX_REMEMBERED_PURCHASES,
	addItem,
	canOpenWithDollars,
	chestOdds,
	rememberPurchase,
	removeItem,
	rollChest,
	wasGranted,
} from "./chests";
export type { DollarOpenCheck, OddsLine, OwnedItem } from "./chests";
export { CHEST_DISTANCE, ROBUX_CHESTS_ALLOWED_ATTRIBUTE, CHEST_RESULT_REMOTE, OPEN_CHEST_REMOTE } from "./network";
