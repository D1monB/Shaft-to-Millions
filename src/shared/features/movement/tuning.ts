// Movement check numbers in one place. Horizontal speed follows the player's walk speed; vertical speed has its own
// limits for rising and falling.

/** Seconds between two server checks of a character. */
export const CHECK_INTERVAL = 0.25;

/**
 * A character may cover this many times its walk speed before a sample counts as suspicious.
 * Why: client positions reach the server in bursts, so honest play shows short speed spikes.
 */
export const SPEED_TOLERANCE = 1.8;

/**
 * Extra studs allowed on top of speed * time: position jitter, slopes, being carried by a moving part (the line belt).
 */
export const SLACK_STUDS = 8;

/**
 * Seconds before the honest anchor moves forward. Longer means the slack matters less (a speed hack is caught
 * sooner relative to its excess), but a pull-back then returns the player further.
 */
export const ANCHOR_WINDOW = 1;

/** A single sample this far beyond the allowance is a teleport: no strikes, pull the player back at once. */
export const TELEPORT_STUDS = 80;

/** Suspicious samples in a row before the player is pulled back. One honest lag spike never reaches this. */
export const MAX_STRIKES = 3;

/**
 * Beyond this many seconds since the anchor the check starts over from the current position.
 * Why: only a stalled server gets here (strikes pull a cheater back long before), and measuring an honest player
 * over a long gap would pull them back by mistake.
 */
export const STALL_SPAN = 3;

/** Studs per second a character may rise (jump, climb). Roblox jump speed is about 50. */
export const MAX_RISE_SPEED = 50;

/**
 * Studs per second a character may fall. The shaft is deep and falls are fast and legal, so this is generous.
 * It only stops "teleport 1000 studs down" in one step. TODO: confirm the real fall speed in a Studio play-test.
 */
export const MAX_FALL_SPEED = 700;

/**
 * After the server moves a character (spawn on a plot, camp, fast travel) the client keeps sending its old position
 * for a few frames. The check waits up to this many seconds for the character to show up at the target.
 */
export const TELEPORT_SETTLE_SECONDS = 2;

/** A character this close to the server's target counts as arrived (studs; spawn height and falling included). */
export const TELEPORT_ARRIVAL_STUDS = 12;
