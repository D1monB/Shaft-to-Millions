// Pure mining rules. No Roblox API: the server service passes in the time and the definitions.
import { OreDef } from "shared/config/ores";
import { PICKAXES, PickaxeDef } from "shared/config/pickaxes";
import {
	RICH_YIELD_MULTIPLIER,
	SWING_TOLERANCE,
	TREASURE_EXTRA_CRYSTALS,
	TREASURE_MIN_CRYSTALS,
	TREASURE_MONEY_MULTIPLIER,
} from "./tuning";

/** The pickaxe with this id. An unknown id (broken save, item from a newer server) falls back to the starter. */
export function getPickaxe(id: string): PickaxeDef {
	return PICKAXES.find((def) => def.id === id) ?? PICKAXES[0];
}

export function canMineTier(ore: OreDef, pickaxe: PickaxeDef): boolean {
	return pickaxe.tier >= ore.requiredTier;
}

/** How many hits one piece of ore takes. Always at least 1. A pickaxe without power can never break anything. */
export function hitsRequired(hardness: number, power: number): number {
	if (!(power > 0) || !(hardness > 0)) {
		return power > 0 ? 1 : math.huge;
	}
	return math.max(1, math.ceil(hardness / power));
}

/**
 * Pieces after a pickaxe-aura bonus (e.g. 0.3 = +30%): `pieces` x (1 + bonus), the fraction turned into one more
 * piece with a dice roll. 0 pieces stay 0, so a bonus never makes ore out of a hit that chipped nothing.
 */
export function scaleYield(pieces: number, bonus: number, roll: number): number {
	if (!(pieces > 0) || pieces === math.huge) {
		return 0;
	}
	const safeBonus = bonus === bonus && bonus > 0 ? math.min(bonus, 10) : 0;
	const exact = math.floor(pieces) * (1 + safeBonus);
	const whole = math.floor(exact);
	return whole + (roll < exact - whole ? 1 : 0);
}

export type HitResult =
	| { readonly kind: "locked"; readonly requiredTier: number }
	| { readonly kind: "cooldown" }
	| { readonly kind: "depleted"; readonly secondsLeft: number }
	/** The block took the hit. `pieces` (may be 0) came off; `taken` of `total` pieces are gone. */
	| { readonly kind: "chip"; readonly pieces: number; readonly taken: number; readonly total: number }
	/** The last pieces came off: the block is gone for this player for `respawnSeconds`. */
	| { readonly kind: "broken"; readonly pieces: number; readonly respawnSeconds: number };

interface NodeState {
	/** Damage that did not add up to a whole piece yet; it carries over to the next hit. */
	damage: number;
	/** Pieces already taken from this block. */
	taken: number;
	depletedUntil: number;
}

/** Pieces in one block; a broken config still gives a block of one piece. */
function piecesOf(ore: OreDef): number {
	return ore.pieces >= 1 && ore.pieces < math.huge ? math.floor(ore.pieces) : 1;
}

/**
 * One player's mining state: what each node still holds, which nodes are depleted for them, and when they
 * last swung. Nodes are per player, so two players never fight over the same block.
 * Every hit chips ore off a block (decision 052): `hardness` damage is one piece, a block holds `pieces` pieces.
 * `K` is the node key (an Instance on the server, a string in tests).
 */
export class MiningSession<K> {
	private readonly nodes = new Map<K, NodeState>();
	private lastHitAt = -math.huge;

	/** `damageMultiplier` > 1 is a critical hit (decision 048); anything not finite or below 1 counts as 1. */
	public hit(node: K, ore: OreDef, pickaxe: PickaxeDef, now: number, damageMultiplier = 1): HitResult {
		if (!canMineTier(ore, pickaxe)) {
			return { kind: "locked", requiredTier: ore.requiredTier };
		}
		// A clock that goes backwards must not grant extra hits.
		if (now < this.lastHitAt || now - this.lastHitAt < pickaxe.swingSeconds * SWING_TOLERANCE) {
			return { kind: "cooldown" };
		}

		let state = this.nodes.get(node);
		if (state === undefined) {
			state = { damage: 0, taken: 0, depletedUntil: -math.huge };
			this.nodes.set(node, state);
		}
		if (now < state.depletedUntil) {
			return { kind: "depleted", secondsLeft: state.depletedUntil - now };
		}

		this.lastHitAt = now;
		const multiplier =
			damageMultiplier === damageMultiplier && damageMultiplier >= 1 && damageMultiplier < math.huge
				? damageMultiplier
				: 1;
		const total = piecesOf(ore);
		// A config without hardness breaks one piece per hit instead of dividing by zero.
		const hardness = ore.hardness > 0 ? ore.hardness : pickaxe.power;
		const damage = state.damage + pickaxe.power * multiplier;
		const chipped = math.min(math.floor(damage / hardness), total - state.taken);
		state.damage = damage - chipped * hardness;
		state.taken += chipped;
		if (state.taken >= total) {
			state.damage = 0;
			state.taken = 0;
			state.depletedUntil = now + ore.respawnSeconds;
			return { kind: "broken", pieces: chipped, respawnSeconds: ore.respawnSeconds };
		}
		return { kind: "chip", pieces: chipped, taken: state.taken, total };
	}

	/** True while the node is depleted for this player. */
	public isDepleted(node: K, now: number): boolean {
		const state = this.nodes.get(node);
		return state !== undefined && now < state.depletedUntil;
	}

	/** Called when a node is removed from the map, so the map does not hold on to it. */
	public forgetNode(node: K): void {
		this.nodes.delete(node);
	}
}

/**
 * Crystals from one broken block (decision 043): 1 with probability `chance`, else 0. `roll` is the server's
 * Random:NextNumber() in [0, 1). Bad input gives 0, so a broken config never hands out crystals.
 */
export function rollCrystals(chance: number, roll: number): number {
	if (!(chance > 0) || chance !== chance || !(roll >= 0) || roll !== roll) {
		return 0;
	}
	return roll < math.min(chance, 1) ? 1 : 0;
}

/** Ore from one broken block: a rich vein (decision 046) multiplies the rolled amount. Bad input gives the amount. */
export function veinYield(amount: number, rich: boolean): number {
	return rich && amount > 0 && amount < math.huge ? amount * RICH_YIELD_MULTIPLIER : amount;
}

export interface TreasureReward {
	readonly money: number;
	readonly crystals: number;
}

/**
 * What a treasure crate (decision 050) gives: money from its layer's ore price and a few crystals. `roll` is the
 * server's Random:NextNumber() in [0, 1); bad input gives the smallest reward, never more.
 */
export function treasureReward(orePrice: number, roll: number): TreasureReward {
	const price = orePrice === orePrice && orePrice > 0 && orePrice < math.huge ? orePrice : 0;
	const unit = roll === roll ? math.clamp(roll, 0, 0.999999) : 0;
	return {
		money: math.floor(price * TREASURE_MONEY_MULTIPLIER),
		crystals: TREASURE_MIN_CRYSTALS + math.floor(unit * (TREASURE_EXTRA_CRYSTALS + 1)),
	};
}
