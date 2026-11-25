// Leaderboard numbers in one place.

/** Rows shown per board. */
export const LEADERBOARD_SIZE = 10;

/**
 * Seconds between two sync rounds: write every player's grown scores, then read the top rows.
 * Every server reads on its own and the DataStore budget is small, so keep this slow.
 */
export const SYNC_INTERVAL = 60;

/**
 * Game meters per stud. Roblox's own conversion is 0.28 m per stud; we round it up a bit so depth numbers feel
 * deep enough on a small test map. Changing it only changes new records: saved meters are never recalculated.
 */
export const METERS_PER_STUD = 0.5;

/**
 * The depth board stores one integer per player: layer * DEPTH_LAYER_FACTOR + meters, so the layer decides
 * first and meters break ties. Must stay above MAX_DEPTH_METERS (config/layers.ts); a test checks it.
 */
export const DEPTH_LAYER_FACTOR = 100_000;
