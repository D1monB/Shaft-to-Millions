// Walk speed from shoes and a speed aura. Pure, so the HUD shows exactly what the server applies.
import { MAX_WALK_SPEED, SHOES } from "shared/config/shoes";

/** The shoes with this id. An unknown id falls back to the starter pair. */
export function shoesFor(id: string) {
	return SHOES.find((def) => def.id === id) ?? SHOES[0];
}

/** Shoes speed times (1 + aura bonus), capped. A broken bonus counts as 0. */
export function walkSpeedFor(shoesId: string, auraBonus: number): number {
	const bonus = auraBonus === auraBonus && auraBonus > 0 ? auraBonus : 0;
	return math.min(shoesFor(shoesId).walkSpeed * (1 + bonus), MAX_WALK_SPEED);
}
