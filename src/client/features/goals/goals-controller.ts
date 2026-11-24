// HUD hint "what next". Features register where goals come from; the shared pickGoal chooses one.
import { BAGS } from "shared/config/bags";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { bagCapacity, bagTotal } from "shared/features/bag";
import { GoalCandidate, pickGoal } from "shared/features/goals";
import { PlayerView } from "shared/features/profile";
import { registerHudLine } from "client/features/hud";

const sources: Array<(view: PlayerView) => GoalCandidate[]> = [];

/** Adds a source of goals, e.g. "buy the furnace". */
export function registerGoalSource(source: (view: PlayerView) => GoalCandidate[]): void {
	sources.push(source);
}

function gearGoals(view: PlayerView): GoalCandidate[] {
	const goals: GoalCandidate[] = [];
	const current = PICKAXES[view.levels.pickaxe - 1];
	const nextPickaxe = PICKAXES[view.levels.pickaxe];
	if (current !== undefined && nextPickaxe !== undefined) {
		const unlocksOre = ORE_IDS.some(
			(id) => ORES[id].requiredTier > current.tier && ORES[id].requiredTier <= nextPickaxe.tier,
		);
		goals.push({ label: nextPickaxe.name, price: nextPickaxe.price, priority: unlocksOre ? 0 : 2 });
	}
	const nextBag = BAGS[view.levels.bag];
	if (nextBag !== undefined) {
		goals.push({ label: nextBag.name, price: nextBag.price, priority: 1 });
	}
	return goals;
}

export function startGoalsController(): void {
	registerGoalSource(gearGoals);
	registerHudLine(90, (view) => {
		const candidates: GoalCandidate[] = [];
		for (const source of sources) {
			for (const goal of source(view)) {
				candidates.push(goal);
			}
		}
		const text = pickGoal(
			{ money: view.money, bagUsed: bagTotal(view.bag), bagCapacity: bagCapacity(view.levels.bag) },
			candidates,
		);
		return `🎯 ${text}`;
	});
}
