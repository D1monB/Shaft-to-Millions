// promo feature (shared): promo code rules (decision 068).
// Public API of this feature. Other code imports only from this file.
export {
	CODE_MAX_CRYSTALS,
	CODE_MAX_LENGTH,
	CODE_MAX_MONEY,
	CODE_MAX_USES,
	CODE_MIN_LENGTH,
	MAX_REDEEMED_CODES,
	hasUsesLeft,
	newPromoRecord,
	normalizeCode,
	readPromoRecord,
} from "./promo";
export type { PromoRecord } from "./promo";

/** Client -> server: (code: string). Redeems a promo code once per player. */
export const REDEEM_CODE_REMOTE = "RedeemCode";
/** Client -> server (owner only): (code, money, crystals, maxUses) creates or replaces a code. */
export const CREATE_CODE_REMOTE = "CreateCode";
/** Client -> server (owner only): (code) deletes a code. */
export const DELETE_CODE_REMOTE = "DeleteCode";
