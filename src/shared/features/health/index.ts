// health feature (shared): fall damage (decision 067).
// Public API of this feature. Other code imports only from this file.
export { fallDamage, stepFall } from "./fall";
export type { FallState } from "./fall";
export { FALL_SAMPLE_SECONDS } from "./tuning";
