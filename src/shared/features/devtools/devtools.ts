// Developer shortcuts for play-testing: money, max gear, gear materials, all layers open.
// Pure rules only. The server service registers the remote ONLY in Roblox Studio (RunService.IsStudio()),
// so on live servers this code is never reachable. Amounts are fixed presets, never a number sent by a client.
import { LAYER_COUNT } from "shared/config/layers";
import { RESOURCE_IDS } from "shared/config/resources";
import { GEAR_BY_SLOT, GEAR_SLOTS } from "shared/features/upgrades";
import { ProfileData, createDefaultProfileData } from "shared/features/profile";
import { PlainTable } from "shared/lib/tables";
import { MAX_COUNTER } from "shared/lib/repair";

export const DEV_MONEY_AMOUNTS: ReadonlyArray<number> = [1_000, 100_000, 10_000_000];

/** Pieces of every ore and product, added by one "materials" command. */
export const DEV_MATERIAL_AMOUNT = 30;

export type DevCommand =
	| { readonly kind: "money"; readonly amount: number }
	| { readonly kind: "maxGear" }
	| { readonly kind: "materials" }
	| { readonly kind: "openLayers" }
	| { readonly kind: "resetProfile" };

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
	if (
		(kind === "maxGear" || kind === "materials" || kind === "openLayers" || kind === "resetProfile") &&
		args.size() === 1
	) {
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
		// Own every item and wear the last (strongest) one of each slot.
		for (const slot of GEAR_SLOTS) {
			const items = GEAR_BY_SLOT[slot];
			for (const def of items) {
				if (!data.gear.owned.includes(def.id)) {
					data.gear.owned.push(def.id);
				}
			}
			data.gear.equipped[slot] = items[items.size() - 1].id;
		}
	} else if (command.kind === "materials") {
		// Every ore and product: enough to try the machines (ore) and the gear shop (ingots, parts) at once.
		for (const id of RESOURCE_IDS) {
			data.warehouse[id] = math.min((data.warehouse[id] ?? 0) + DEV_MATERIAL_AMOUNT, MAX_COUNTER);
		}
	} else if (command.kind === "resetProfile") {
		resetProfile(data);
	} else {
		data.deepestLayer = LAYER_COUNT;
	}
}

/** Fields a reset keeps: the version (the data is still this version) and Robux receipts (already granted, see below). */
const KEPT_ON_RESET: ReadonlyArray<string> = ["schemaVersion", "purchaseIds"];

/**
 * Puts the profile back to a brand-new player, in place (the live table must stay the same object, the session
 * saves it). Granted Robux receipt ids are KEPT: a purchase that was paid and granted must never be granted twice,
 * and a test reset is no reason to forget it. Studio only, like every dev command.
 */
function resetProfile(data: ProfileData): void {
	const fresh = createDefaultProfileData() as unknown as PlainTable;
	const target = data as unknown as PlainTable;
	for (const [key, value] of pairs(fresh)) {
		if (!KEPT_ON_RESET.includes(key as string)) {
			target[key as string] = value;
		}
	}
}
