// Remote names of the mining feature. Without a tool, a hit is a ClickDetector click (server side). With a pickaxe
// Tool in hand Roblox switches ClickDetectors off, so the swing sends MineHit; the server checks it the same way.

/** Client -> server: (node: Instance) the ore node under the cursor when the pickaxe Tool was swung. */
export const MINE_HIT_REMOTE = "MineHit";

/**
 * Server -> client: (node: Instance, taken: number, total: number, crit: boolean, oreId: string, amount: number)
 * after a counted hit that did not empty the block. `amount` pieces went into the bag (0 for a treasure crate).
 */
export const MINE_PROGRESS_REMOTE = "MineProgress";

/** Server -> client: (node, respawnSeconds: number, oreId: string, amount: number, crit: boolean) after the last chip. */
export const NODE_BROKEN_REMOTE = "NodeBroken";
