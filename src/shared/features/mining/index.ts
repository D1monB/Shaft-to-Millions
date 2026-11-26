// mining feature (shared): tool tiers, hits per node, swing cooldown, node respawn and ore yield.
// Pure logic, unit tested. The server feature applies it; the client only shows effects.
// Public API of this feature. Other code imports only from this file.
export { MiningSession, canMineTier, getPickaxe, hitsRequired, rollYield } from "./mining";
export type { HitResult } from "./mining";
export { MINE_HIT_REMOTE, MINE_PROGRESS_REMOTE, NODE_BROKEN_REMOTE } from "./network";
export {
	CLICK_DISTANCE,
	MAX_MINING_DISTANCE,
	ORE_FILL_FRACTION,
	ORE_SHUFFLE_CLEAR_RADIUS,
	ORE_SHUFFLE_FRACTION,
	ORE_SHUFFLE_SECONDS,
	PORTAL_ORE_RADIUS,
} from "./tuning";
export { activeCount, pickRandom } from "./ore-generation";
export { oreForSpawn, tierOf } from "./ore-spawns";
export { parseHitRequest } from "./hit-request";
export type { HitRequest } from "./hit-request";
