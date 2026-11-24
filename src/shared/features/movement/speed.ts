// Walk speed from shoes and a speed aura. Pure, so the HUD shows exactly what the server applies.
import { MAX_WALK_SPEED, SHOES } from "shared/config/shoes";

export function shoesFor(level: number) {
	const safe = level === level ? math.clamp(math.floor(level), 1, SHOES.size()) : 1;
	return SHOES[safe - 1];
}

/** Shoes speed times (1 + aura bonus), capped. A broken bonus counts as 0. */
export function walkSpeedFor(shoesLevel: number, auraBonus: number): number {
	const bonus = auraBonus === auraBonus && auraBonus > 0 ? auraBonus : 0;
	return math.min(shoesFor(shoesLevel).walkSpeed * (1 + bonus), MAX_WALK_SPEED);
}
