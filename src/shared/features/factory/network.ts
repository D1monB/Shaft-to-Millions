// Remote names of the factory feature. Every request is checked on the server (place, ids, counts).

/** () Unload the bag into the warehouse. At a Warehouse. */
export const DEPOSIT_BAG_REMOTE = "DepositBag";
/** () Sell everything in the warehouse. At a Warehouse. */
export const SELL_WAREHOUSE_REMOTE = "SellWarehouse";
/** (machineId) Buy a machine. At its Machine spot. */
export const BUY_MACHINE_REMOTE = "BuyMachine";
/** (machineId, recipeId, count) Queue crafts. At the machine. */
export const ENQUEUE_REMOTE = "EnqueueCraft";
/** (machineId) Move finished output to the warehouse. At the machine. */
export const COLLECT_REMOTE = "CollectOutput";
/** (machineId) Cancel the last queued craft. At the machine. */
export const CANCEL_REMOTE = "CancelCraft";

/** (machineId, track) Buy the next level of a machine track: "speed" or "queue". At the machine. */
export const UPGRADE_MACHINE_REMOTE = "UpgradeMachine";
/** () Buy the next warehouse capacity level. At a Warehouse. */
export const UPGRADE_WAREHOUSE_REMOTE = "UpgradeWarehouse";

/** How close (studs) the player must be to the warehouse or a machine. */
export const FACTORY_DISTANCE = 18;

/** Max crafts one request may queue (the UI offers +1 and +5). */
export const MAX_ENQUEUE_PER_REQUEST = 10;
