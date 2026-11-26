// Layer events (decision 065): cave-ins, shared crystal clusters and the timed raid with a weekly top.

/** Every this many seconds the server may drop rocks near one miner. */
export const CAVE_IN_EVERY_SECONDS = 45;
/** Chance that a check actually starts a cave-in. */
export const CAVE_IN_CHANCE = 0.5;
/** Only players this close (studs) to an ore block are "mining" and can get a cave-in. */
export const CAVE_IN_MINING_RADIUS = 14;
/** Seconds the red warning circle shows before the rocks land. */
export const CAVE_IN_WARNING_SECONDS = 3;
/** Radius (studs) of the danger circle. */
export const CAVE_IN_RADIUS = 9;
/** A soft penalty (nothing is lost): walk speed x (1 - this) ... */
export const CAVE_IN_SLOW = 0.4;
/** ... for this many seconds. */
export const CAVE_IN_SLOW_SECONDS = 5;

/** A crystal cluster appears every this many seconds when none is waiting. */
export const CLUSTER_EVERY_SECONDS = 600;
/** A treasure crate or cluster nobody took disappears after this long, so a new one can come. */
export const EVENT_BLOCK_LIFETIME_SECONDS = 240;
/** Swings of all players together needed to break it. */
export const CLUSTER_HITS = 40;
/** Crystals for everyone who hit it at least CLUSTER_MIN_HITS times ... */
export const CLUSTER_BASE_CRYSTALS = 2;
/** ... plus this pool, shared by how much each one hit. */
export const CLUSTER_SHARED_CRYSTALS = 8;
export const CLUSTER_MIN_HITS = 3;

/** One raid lasts this long. */
export const RAID_SECONDS = 120;
/** A new raid may start this long after the last one started. */
export const RAID_COOLDOWN_SECONDS = 10 * 60;
/** One reward crystal per this many ore pieces mined during the raid ... */
export const RAID_PIECES_PER_CRYSTAL = 25;
/** ... at most this many. */
export const RAID_MAX_CRYSTALS = 15;
/** Rows of the weekly raid top. */
export const RAID_TOP_SIZE = 10;
/** Seconds between two reads of the weekly top. */
export const RAID_TOP_SYNC_SECONDS = 60;
