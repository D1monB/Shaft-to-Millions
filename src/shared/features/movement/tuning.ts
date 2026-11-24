// Movement check numbers in one place. The check only looks at HORIZONTAL speed: falling is legal and fast.

/** Seconds between two server checks of a character. */
export const CHECK_INTERVAL = 0.25;

/**
 * A character may cover this many times its walk speed before a sample counts as suspicious.
 * Why: client positions reach the server in bursts, so honest play shows short speed spikes.
 */
export const SPEED_TOLERANCE = 1.5;

/** Extra studs allowed on top of speed * time (position jitter, slopes, being pushed by a moving part). */
export const SLACK_STUDS = 4;

/**
 * Seconds before the honest anchor moves forward. Longer means the slack matters less (a speed hack is caught
 * sooner relative to its excess), but a pull-back then returns the player further.
 */
export const ANCHOR_WINDOW = 1;

/** A single sample this far beyond the allowance is a teleport: no strikes, pull the player back at once. */
export const TELEPORT_STUDS = 50;

/** Suspicious samples in a row before the player is pulled back. One honest lag spike never reaches this. */
export const MAX_STRIKES = 3;

/**
 * Longest time span (seconds) a sample may be measured over.
 * Why: a strike keeps the old position, so the span grows; without a cap a cheater would get a growing allowance.
 */
export const MAX_SPAN = 3;
