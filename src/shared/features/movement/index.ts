// movement feature (shared): walk speed from shoes and auras, and the server-side movement check.
// Public API of this feature. Other code imports only from this file.
export { shoesFor, walkSpeedFor } from "./speed";
export { beginMoveState, checkMove } from "./move-check";
export type { MoveResult, MoveSample, MoveState, MoveVerdict } from "./move-check";
export { CHECK_INTERVAL } from "./tuning";
export { beginSettle, settle } from "./teleport-settle";
export type { PendingTeleport, Point, SettleVerdict } from "./teleport-settle";
