// Developer shortcuts for play-testing: money, max gear, all layers open.
// Pure rules only. The server service registers the remote ONLY in Roblox Studio (RunService.IsStudio()),
// so on live servers this code is never reachable. Amounts are fixed presets, never a number sent by a client.
import { LAYER_COUNT } from "shared/config/layers";
import { BAGS } from "shared/config/bags";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import type { ProfileData } from "shared/features/profile";
import { MAX_COUNTER } from "shared/lib/repair";

export const DEV_MONEY_AMOUNTS: ReadonlyArray<number> = [1_000, 100_000, 10_000_000];

export type DevCommand =
	| { readonly kind: "money"; readonly amount: number }
	| { readonly kind: "maxGear" }
	| { readonly kind: "openLayers" };

/** Turns raw remote arguments into a command, or undefined when anything is off (count, type, unknown preset). */
export function parseDevCommand(args: ReadonlyArray<unknown>): DevCommand | undefined {
	const kind = args[0];
	if (kind === "money") {
		const amount = args[1];
		if (args.size() !== 2 || !typeIs(amount, "number") || !DEV_MONEY_AMOUNTS.includes(amount)) {
			return undefined;
		}
		return { kind: "money", amount };
	}
	if ((kind === "maxGear" || kind === "openLayers") && args.size() === 1) {
		return { kind };
	}
	return undefined;
}

/**
 * Applies the command to the live profile. Dev money does not count as "earned" (lifetime stats stay honest)
 * and never exceeds the global counter cap.
 */
export function applyDevCommand(data: ProfileData, command: DevCommand): void {
	if (command.kind === "money") {
		data.money = math.min(data.money + command.amount, MAX_COUNTER);
	} else if (command.kind === "maxGear") {
		data.levels.pickaxe = PICKAXES.size();
		data.levels.bag = BAGS.size();
		data.levels.shoes = SHOES.size();
	} else {
		data.deepestLayer = LAYER_COUNT;
	}
}
