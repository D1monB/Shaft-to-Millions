/** Drops up to this many studs never hurt (a jump, a ramp). */
export const FALL_SAFE_HEIGHT = 18;
/** Health lost per stud above the safe height (100 = full health). */
export const FALL_DAMAGE_PER_STUD = 2;
/** A single fall never takes more than this: soft, but it hurts. */
export const FALL_MAX_DAMAGE = 70;
/** A bigger height change between two samples is a teleport or a ride, not a fall (studs). */
export const FALL_RESET_STEP = 45;
/** How often the server samples heights (seconds). */
export const FALL_SAMPLE_SECONDS = 0.1;
