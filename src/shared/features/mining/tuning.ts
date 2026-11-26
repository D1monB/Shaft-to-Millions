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

/** Chance that a placed ore block is a rich vein (decision 046): it sparkles and gives more ore. */
export const RICH_ORE_CHANCE = 0.08;

/** Ore from a rich vein = normal yield times this. */
export const RICH_YIELD_MULTIPLIER = 3;

/** Chance that a placed ore block is a geode (decision 060): it glows purple and pays crystals when emptied. */
export const GEODE_CHANCE = 0.03;

/** Geode crystals: at least this many ... */
export const GEODE_MIN_CRYSTALS = 1;

/** ... and up to this many more, at random. */
export const GEODE_EXTRA_CRYSTALS = 2;

/** Chance that a geode also switches on a random booster ... */
export const GEODE_BOOST_CHANCE = 0.25;

/** ... for this long. */
export const GEODE_BOOST_SECONDS = 300;

/** Chance that one swing is a critical hit (decision 048). */
export const CRIT_CHANCE = 0.12;

/** A critical hit deals this many times the pickaxe power. */
export const CRIT_MULTIPLIER = 3;

/** An ore rush (decision 048) starts every this many seconds ... */
export const ORE_RUSH_EVERY_SECONDS = 480;

/** ... lasts this long ... */
export const ORE_RUSH_SECONDS = 60;

/** ... and makes this share of the blocks no one stands at rich for its duration. */
export const ORE_RUSH_RICH_SHARE = 0.35;

/** A treasure crate (decision 050) appears in the pit every this many seconds when none is waiting. */
export const TREASURE_EVERY_SECONDS = 120;

/** Treasure money = the price of its layer's ore times this. */
export const TREASURE_MONEY_MULTIPLIER = 150;

/** Treasure crystals: at least this many ... */
export const TREASURE_MIN_CRYSTALS = 2;

/** ... and up to this many more, at random. */
export const TREASURE_EXTRA_CRYSTALS = 4;
