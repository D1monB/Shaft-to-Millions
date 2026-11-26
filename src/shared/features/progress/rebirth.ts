// Rebirth (prestige, decision 070): start the mine and the factory again for a permanent money bonus.
import {
	MAX_REBIRTHS,
	REBIRTH_CRYSTALS,
	REBIRTH_MONEY_BONUS,
	REBIRTH_PRICE,
	REBIRTH_PRICE_GROWTH,
} from "shared/config/retention";
import { isFiniteNumber } from "shared/lib/validate";

function safeCount(rebirths: number): number {
	return isFiniteNumber(rebirths) ? math.clamp(math.floor(rebirths), 0, MAX_REBIRTHS) : 0;
}

/** Money needed for the next rebirth, or undefined at the maximum. */
export function rebirthPrice(rebirths: number): number | undefined {
	const count = safeCount(rebirths);
	return count >= MAX_REBIRTHS ? undefined : math.floor(REBIRTH_PRICE * math.pow(REBIRTH_PRICE_GROWTH, count));
}

/** What every sale and the line are multiplied by after `rebirths`. */
export function rebirthMultiplier(rebirths: number): number {
	return 1 + safeCount(rebirths) * REBIRTH_MONEY_BONUS;
}

export function canRebirth(rebirths: number, money: number): boolean {
	const price = rebirthPrice(rebirths);
	return price !== undefined && money >= price;
}

export const REBIRTH_REWARD_CRYSTALS = REBIRTH_CRYSTALS;
