/** Client -> server: (chestId). Open with dollars. At a Chest stand. */
export const OPEN_CHEST_REMOTE = "OpenChest";
/** Server -> client: (itemId, chestId). Shows what came out. */
export const CHEST_RESULT_REMOTE = "ChestResult";
/** Server -> client: (robuxAllowed: boolean). From PolicyService; false hides every Robux button. */
export const CHEST_POLICY_REMOTE = "ChestPolicy";

export const CHEST_DISTANCE = 16;
