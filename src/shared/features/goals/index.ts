// goals feature (shared): picks the single "what next" hint shown on the HUD.
// Public API of this feature. Other code imports only from this file.
export { pickGoal, pickGoalInfo } from "./goals";
export type { GoalCandidate, GoalInfo, GoalKind, GoalState } from "./goals";
