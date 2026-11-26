// Promo code rules (decision 068). Codes live only in the server's DataStore: the repository is public, so a code
// written in a file would be known to everyone. This file holds only the rules.
import { isIntegerInRange } from "shared/lib/validate";

export const CODE_MIN_LENGTH = 4;
export const CODE_MAX_LENGTH = 24;
/** Money and crystals one code may give. */
export const CODE_MAX_MONEY = 1_000_000_000;
export const CODE_MAX_CRYSTALS = 10_000;
export const CODE_MAX_USES = 1_000_000;
/** Codes remembered per player, so each code pays a player once. */
export const MAX_REDEEMED_CODES = 200;

export interface PromoRecord {
	readonly money: number;
	readonly crystals: number;
	readonly maxUses: number;
	uses: number;
}

/** Upper case without surrounding spaces; undefined unless it is 4..24 letters, digits, "_" or "-". */
export function normalizeCode(input: unknown): string | undefined {
	if (!typeIs(input, "string") || input.size() > 64) {
		return undefined;
	}
	const [trimmed] = input.gsub("^%s*(.-)%s*$", "%1");
	const code = trimmed.upper();
	if (code.size() < CODE_MIN_LENGTH || code.size() > CODE_MAX_LENGTH) {
		return undefined;
	}
	return string.match(code, "^[A-Z0-9_%-]+$")[0] !== undefined ? code : undefined;
}

/** A new code from the owner's panel, or undefined for numbers out of range or a code that gives nothing. */
export function newPromoRecord(money: unknown, crystals: unknown, maxUses: unknown): PromoRecord | undefined {
	if (
		!isIntegerInRange(money, 0, CODE_MAX_MONEY) ||
		!isIntegerInRange(crystals, 0, CODE_MAX_CRYSTALS) ||
		!isIntegerInRange(maxUses, 1, CODE_MAX_USES) ||
		money + crystals <= 0
	) {
		return undefined;
	}
	return { money, crystals, maxUses, uses: 0 };
}

/** A stored value read back from the DataStore; anything odd means "no such code". */
export function readPromoRecord(value: unknown): PromoRecord | undefined {
	if (!typeIs(value, "table")) {
		return undefined;
	}
	const raw = value as Partial<Record<keyof PromoRecord, unknown>>;
	const record = newPromoRecord(raw.money, raw.crystals, raw.maxUses);
	if (record === undefined || !isIntegerInRange(raw.uses, 0, CODE_MAX_USES)) {
		return undefined;
	}
	record.uses = raw.uses;
	return record;
}

export function hasUsesLeft(record: PromoRecord): boolean {
	return record.uses < record.maxUses;
}
