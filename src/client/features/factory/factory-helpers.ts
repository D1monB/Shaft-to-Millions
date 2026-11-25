// Small shared helpers of the factory UI: machine state ticking locally, recipe values and times.
import { MACHINE_IDS, RECIPES, RecipeId, ResourceAmounts, recipesOf } from "shared/config/machines";
import { RESOURCES, RESOURCE_IDS } from "shared/config/resources";
import { MachineState, advance, craftSeconds } from "shared/features/factory";
import { PlayerView } from "shared/features/profile";
import { deepCopy } from "shared/lib/tables";

/** The machine as it is at `now`: the view is advanced locally so timers tick between server updates. */
export function liveState(state: MachineState, now: number): MachineState {
	const copy = deepCopy(state);
	advance(copy, now);
	return copy;
}

/** True while a machine still has work in its queue at `now`: the only time its timers change on screen. */
export function isMachineBusy(state: MachineState | undefined, now: number): boolean {
	return state !== undefined && liveState(state, now).queue.size() > 0;
}

export function amountsText(amounts: ResourceAmounts): string {
	const parts: string[] = [];
	for (const id of RESOURCE_IDS) {
		const amount = amounts[id];
		if (amount !== undefined) {
			parts.push(`${amount} ${RESOURCES[id].name}`);
		}
	}
	return parts.join(" + ");
}

export function amountsValue(amounts: ResourceAmounts): number {
	let value = 0;
	for (const [id, amount] of pairs(amounts)) {
		value += RESOURCES[id].price * amount;
	}
	return value;
}

/** Resources of an amounts table in the fixed resource order, so tiles never jump around. */
export function amountsList(amounts: ResourceAmounts) {
	const list: Array<{ id: (typeof RESOURCE_IDS)[number]; amount: number }> = [];
	for (const id of RESOURCE_IDS) {
		const amount = amounts[id];
		if (amount !== undefined && amount > 0) {
			list.push({ id, amount });
		}
	}
	return list;
}

export function ownedRecipes(view: PlayerView): RecipeId[] {
	const result: RecipeId[] = [];
	for (const machineId of MACHINE_IDS) {
		if (view.machines[machineId] !== undefined) {
			for (const recipeId of recipesOf(machineId)) {
				result.push(recipeId);
			}
		}
	}
	return result;
}

/** Seconds of one craft with the machine's current speed upgrade, the same as the server uses. */
export function secondsAtUpgrades(view: PlayerView, recipeId: RecipeId): number {
	const machine = view.machines[RECIPES[recipeId].machine];
	return craftSeconds(recipeId, machine?.speedLevel ?? 1);
}
