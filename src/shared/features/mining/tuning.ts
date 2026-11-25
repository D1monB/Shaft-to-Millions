// Mining balance and anti-cheat numbers in one place.

/**
 * Hits may arrive this much faster than the pickaxe's swing time and still count.
 * Why: network jitter bunches clicks together; 0.8 forgives that but still stops auto-clickers from
 * mining much faster than intended.
 */
export const SWING_TOLERANCE = 0.8;

/** How far (studs) the character's root may be from a node. ClickDetector distance plus some slack for lag. */
export const MAX_MINING_DISTANCE = 20;

/** ClickDetector activation distance shown to players. */
export const CLICK_DISTANCE = 16;

/** Ore spawn points of layer 5 closer than this to the portal (studs, on the ground plane) grow iridium. */
export const PORTAL_ORE_RADIUS = 60;
