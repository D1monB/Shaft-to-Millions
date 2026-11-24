// Remote names of the mining feature. Mining input itself goes through ClickDetectors (server side),
// so there is no client -> server remote here: the client cannot even claim a hit on its own.

/** Server -> client: (node: Instance, damage: number, hardness: number) after a counted hit. */
export const MINE_PROGRESS_REMOTE = "MineProgress";

/** Server -> client: (node: Instance, respawnSeconds: number, oreId: string, amount: number) after a break. */
export const NODE_BROKEN_REMOTE = "NodeBroken";
