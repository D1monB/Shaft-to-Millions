// The decision logic of ProcessReceipt, without Roblox API, so every path is unit tested.
// chests-service.ts wires the real profile, policy, roll and save into these ports.
import { ProfileData } from "shared/features/profile";
import { rememberPurchase, wasGranted } from "shared/features/chests";

export interface ReceiptPorts {
	/** The buyer's live data, or undefined if they are not in this server / not loaded. */
	readonly getData: () => ProfileData | undefined;
	/** PolicyService result for the buyer. false also when unknown (fail closed). */
	readonly robuxAllowed: () => boolean;
	/** Rolls and adds the item. false when the inventory hard cap is reached (nothing was added). */
	readonly grant: (data: ProfileData) => boolean;
	/** Saves now and waits for confirmation. */
	readonly save: () => boolean;
	readonly notify: (text: string) => void;
}

export type ReceiptDecision = "granted" | "not-processed";

/**
 * Exactly-once rules:
 * - a PurchaseId already in the profile is never granted again (only re-saved and confirmed);
 * - the id is recorded in the same step as the item, with no yield in between;
 * - "granted" is returned only after a confirmed save, otherwise Roblox retries and the retry finds the id.
 */
export function decideReceipt(purchaseId: string, ports: ReceiptPorts): ReceiptDecision {
	const data = ports.getData();
	if (data === undefined) {
		return "not-processed";
	}
	if (wasGranted(data.purchaseIds, purchaseId)) {
		return ports.save() ? "granted" : "not-processed";
	}
	if (!ports.robuxAllowed()) {
		ports.notify("Відкриття скринь за Robux недоступне для твого акаунта.");
		return "not-processed";
	}
	rememberPurchase(data.purchaseIds, purchaseId);
	if (!ports.grant(data)) {
		// Nothing was added, so forget the id: a later retry (after freeing space) must be able to grant.
		data.purchaseIds.remove(data.purchaseIds.indexOf(purchaseId));
		ports.notify("Інвентар переповнений. Звільни місце: покупку буде видано пізніше.");
		return "not-processed";
	}
	return ports.save() ? "granted" : "not-processed";
}
