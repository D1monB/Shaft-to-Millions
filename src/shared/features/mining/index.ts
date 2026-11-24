// mining feature (shared): tool tiers, hits per node, swing cooldown, node respawn and ore yield.
// Pure logic, unit tested. The server feature applies it; the client only shows effects.
// Public API of this feature. Other code imports only from this file.
export { MiningSession, canMineTier, getPickaxe, hitsRequired, rollYield } from "./mining";
export type { HitResult } from "./mining";
export { MINE_PROGRESS_REMOTE, NODE_BROKEN_REMOTE } from "./network";
export { CLICK_DISTANCE, MAX_MINING_DISTANCE } from "./tuning";
