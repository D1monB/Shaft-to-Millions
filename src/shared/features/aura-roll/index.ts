// aura-roll feature (shared): the spin machine for auras with free spins and a pity guarantee (decision 064).
// Public API of this feature. Other code imports only from this file.
export { canSpin, isSpinPay, newAuraRollState, refreshSpins, rollOdds, secondsToNextSpin, spin } from "./aura-roll";
export type { AuraRollState, RollOdds, SpinCheck, SpinPay } from "./aura-roll";

/** Client -> server: (pay: "free" | "crystals"). One spin. */
export const SPIN_AURA_REMOTE = "SpinAura";
/** Server -> client: (item: ItemId) what the spin gave; the client plays the reel. */
export const SPIN_RESULT_REMOTE = "SpinResult";
/** Client -> server: no arguments. Sells every spare copy (keeps one of each, and everything equipped). */
export const SELL_DUPLICATES_REMOTE = "SellDuplicates";
