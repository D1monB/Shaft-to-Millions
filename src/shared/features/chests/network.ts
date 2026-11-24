/** Client -> server: (chestId). Open with dollars. At a Chest stand. */
export const OPEN_CHEST_REMOTE = "OpenChest";
/** Server -> client: (itemId, chestId). Shows what came out. */
export const CHEST_RESULT_REMOTE = "ChestResult";
/**
 * Player attribute (boolean) set by the server from PolicyService. Missing or false hides every Robux button.
 * An attribute instead of a remote message: it replicates whenever the client is ready, so it cannot be missed.
 */
export const ROBUX_CHESTS_ALLOWED_ATTRIBUTE = "RobuxChestsAllowed";

export const CHEST_DISTANCE = 16;
