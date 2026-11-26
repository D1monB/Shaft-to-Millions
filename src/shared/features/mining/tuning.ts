// Mining balance and anti-cheat numbers in one place.

/**
 * Hits may arrive this much faster than the pickaxe's swing time and still count.
 * Why: network jitter bunches clicks together; 0.8 forgives that but still stops auto-clickers from
 * mining much faster than intended.
 */
export const SWING_TOLERANCE = 0.8;

/** How far (studs) the character's root may be from a node. ClickDetector distance plus some slack for lag. */
export const MAX_MINING_DISTANCE = 24;

/** ClickDetector activation distance shown to players. */
export const CLICK_DISTANCE = 20;

/** Ore spawn points of layer 5 closer than this to the portal (studs, on the ground plane) grow iridium. */
export const PORTAL_ORE_RADIUS = 60;

/** Share of each layer's spawn points that hold ore at once; the rest stay empty, so ore is scattered, not a ring. */
export const ORE_FILL_FRACTION = 0.4;

/** Every this many seconds some ore blocks move to free points of their layer. */
export const ORE_SHUFFLE_SECONDS = 60;

/** Share of a layer's blocks that move at each shuffle. */
export const ORE_SHUFFLE_FRACTION = 0.25;

/** A block with a player this close (studs) stays put, so nobody loses the block they are mining. */
export const ORE_SHUFFLE_CLEAR_RADIUS = 24;
