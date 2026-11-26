// Pure rules of the aura roll machine (decision 064). Time and the random roll are passed in, so it is unit tested.
import {
	AURA_ROLL_TABLE,
	FREE_SPIN_SECONDS,
	MAX_FREE_SPINS,
	PITY_SPINS,
	RollEntry,
	SPIN_CRYSTAL_PRICE,
	START_FREE_SPINS,
} from "shared/config/aura-roll";
import { INVENTORY_LIMIT, ITEMS, ItemId, Rarity } from "shared/config/items";
import { isFiniteNumber } from "shared/lib/validate";

export interface AuraRollState {
	/** Free spins waiting. */
	spins: number;
	/** Unix time the next free spin counts from; 0 = starts at the next refresh. */
	spinAt: number;
	/** Spins since the last epic or better. */
	pity: number;
}

export type SpinPay = "free" | "crystals";

export function isSpinPay(value: unknown): value is SpinPay {
	return value === "free" || value === "crystals";
}

export function newAuraRollState(): AuraRollState {
	return { spins: START_FREE_SPINS, spinAt: 0, pity: 0 };
}

/** Adds the free spins that came back by `now`. Returns true when something changed. */
export function refreshSpins(state: AuraRollState, now: number): boolean {
	if (!isFiniteNumber(now) || now <= 0) {
		return false;
	}
	if (state.spinAt <= 0 || state.spinAt > now || state.spins >= MAX_FREE_SPINS) {
		// Full (or fresh, or a clock that went back): the timer simply starts from now.
		const changed = state.spinAt !== now;
		state.spinAt = now;
		return changed && state.spins < MAX_FREE_SPINS;
	}
	const earned = math.floor((now - state.spinAt) / FREE_SPIN_SECONDS);
	if (earned <= 0) {
		return false;
	}
	const added = math.min(earned, MAX_FREE_SPINS - state.spins);
	state.spins += added;
	state.spinAt = state.spins >= MAX_FREE_SPINS ? now : state.spinAt + earned * FREE_SPIN_SECONDS;
	return true;
}

/** Seconds until the next free spin; 0 when the machine is full. */
export function secondsToNextSpin(state: AuraRollState, now: number): number {
	if (state.spins >= MAX_FREE_SPINS) {
		return 0;
	}
	const waited = isFiniteNumber(now) && state.spinAt > 0 ? math.max(0, now - state.spinAt) : 0;
	return math.max(0, FREE_SPIN_SECONDS - (waited % FREE_SPIN_SECONDS));
}

export type SpinCheck =
	| { readonly ok: true; readonly cost: number }
	| { readonly ok: false; readonly reason: "no-spins" | "crystals" | "inventory-full" };

export function canSpin(state: AuraRollState, pay: SpinPay, crystals: number, inventorySize: number): SpinCheck {
	if (inventorySize >= INVENTORY_LIMIT) {
		return { ok: false, reason: "inventory-full" };
	}
	if (pay === "free") {
		return state.spins >= 1 ? { ok: true, cost: 0 } : { ok: false, reason: "no-spins" };
	}
	return crystals >= SPIN_CRYSTAL_PRICE ? { ok: true, cost: SPIN_CRYSTAL_PRICE } : { ok: false, reason: "crystals" };
}

const RARE_ENOUGH: ReadonlyArray<Rarity> = ["epic", "legendary"];

function isEpicOrBetter(item: ItemId): boolean {
	return RARE_ENOUGH.includes(ITEMS[item].rarity);
}

function pick(entries: ReadonlyArray<RollEntry>, roll: number): ItemId {
	let total = 0;
	for (const entry of entries) {
		total += entry.weight;
	}
	// A broken roll never favours a rare aura: it counts as 0, the first (common) entry.
	let cursor = (roll === roll ? math.clamp(roll, 0, 0.999999) : 0) * total;
	for (const entry of entries) {
		if (cursor < entry.weight) {
			return entry.item;
		}
		cursor -= entry.weight;
	}
	return entries[entries.size() - 1].item;
}

/** Rolls an aura and updates the pity counter. The caller already checked and charges in the same frame. */
export function spin(state: AuraRollState, roll: number): ItemId {
	const guaranteed = state.pity + 1 >= PITY_SPINS;
	const entries = guaranteed ? AURA_ROLL_TABLE.filter((entry) => isEpicOrBetter(entry.item)) : AURA_ROLL_TABLE;
	const item = pick(entries, roll);
	state.pity = isEpicOrBetter(item) ? 0 : state.pity + 1;
	return item;
}

export interface RollOdds {
	readonly item: ItemId;
	readonly chance: number;
}

/** The chances of a normal spin, shown to the player before they spin. */
export function rollOdds(): RollOdds[] {
	let total = 0;
	for (const entry of AURA_ROLL_TABLE) {
		total += entry.weight;
	}
	return AURA_ROLL_TABLE.map((entry) => ({ item: entry.item, chance: entry.weight / total }));
}
