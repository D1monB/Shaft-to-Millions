// Pure mining rules. No Roblox API: the server service passes in the time and the definitions.
import { OreDef } from "shared/config/ores";
import { PICKAXES, PickaxeDef } from "shared/config/pickaxes";
import { SWING_TOLERANCE } from "./tuning";

/** The pickaxe with this id. An unknown id (broken save, item from a newer server) falls back to the starter. */
export function getPickaxe(id: string): PickaxeDef {
	return PICKAXES.find((def) => def.id === id) ?? PICKAXES[0];
}

export function canMineTier(ore: OreDef, pickaxe: PickaxeDef): boolean {
	return pickaxe.tier >= ore.requiredTier;
}

/** How many hits a node takes. Always at least 1. A pickaxe without power can never break anything. */
export function hitsRequired(hardness: number, power: number): number {
	if (!(power > 0) || !(hardness > 0)) {
		return power > 0 ? 1 : math.huge;
	}
	return math.max(1, math.ceil(hardness / power));
}

/**
 * Pieces of ore from one broken node. `bonus` (e.g. 0.3 = +30% from a pickaxe aura) is turned into a whole
 * number with a dice roll: 1.3 means "1 piece, plus 1 more with 30% chance". `roll` is in [0, 1).
 * Taking the roll as a parameter keeps this function pure and testable.
 */
export function rollYield(bonus: number, roll: number): number {
	const safeBonus = bonus === bonus && bonus > 0 ? math.min(bonus, 10) : 0;
	const whole = math.floor(safeBonus);
	const fraction = safeBonus - whole;
	return 1 + whole + (roll < fraction ? 1 : 0);
}

export type HitResult =
	| { readonly kind: "locked"; readonly requiredTier: number }
	| { readonly kind: "cooldown" }
	| { readonly kind: "depleted"; readonly secondsLeft: number }
	| { readonly kind: "progress"; readonly damage: number; readonly hardness: number }
	| { readonly kind: "broken"; readonly respawnSeconds: number };

interface NodeState {
	damage: number;
	depletedUntil: number;
}

/**
 * One player's mining state: damage dealt to each node, which nodes are depleted for them, and when they
 * last swung. Nodes are per player, so two players never fight over the same block.
 * `K` is the node key (an Instance on the server, a string in tests).
 */
export class MiningSession<K> {
	private readonly nodes = new Map<K, NodeState>();
	private lastHitAt = -math.huge;

	public hit(node: K, ore: OreDef, pickaxe: PickaxeDef, now: number): HitResult {
		if (!canMineTier(ore, pickaxe)) {
			return { kind: "locked", requiredTier: ore.requiredTier };
		}
		// A clock that goes backwards must not grant extra hits.
		if (now < this.lastHitAt || now - this.lastHitAt < pickaxe.swingSeconds * SWING_TOLERANCE) {
			return { kind: "cooldown" };
		}

		let state = this.nodes.get(node);
		if (state === undefined) {
			state = { damage: 0, depletedUntil: -math.huge };
			this.nodes.set(node, state);
		}
		if (now < state.depletedUntil) {
			return { kind: "depleted", secondsLeft: state.depletedUntil - now };
		}

		this.lastHitAt = now;
		state.damage += pickaxe.power;
		if (state.damage >= ore.hardness) {
			state.damage = 0;
			state.depletedUntil = now + ore.respawnSeconds;
			return { kind: "broken", respawnSeconds: ore.respawnSeconds };
		}
		return { kind: "progress", damage: state.damage, hardness: ore.hardness };
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
