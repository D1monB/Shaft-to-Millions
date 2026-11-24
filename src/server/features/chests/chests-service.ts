// Chests: opening with dollars (at a chest stand) and with Robux (Developer Products via ProcessReceipt).
// Every roll happens here, on the server, with the server's Random.
import { CollectionService, MarketplaceService, Players, PolicyService } from "@rbxts/services";
import { CHESTS, CHEST_IDS, ChestId, isChestId } from "shared/config/chests";
import { ItemId } from "shared/config/items";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import {
	CHEST_DISTANCE,
	CHEST_POLICY_REMOTE,
	CHEST_RESULT_REMOTE,
	OPEN_CHEST_REMOTE,
	addItem,
	canOpenWithDollars,
	rememberPurchase,
	rollChest,
	wasGranted,
} from "shared/features/chests";
import { ProfileData } from "shared/features/profile";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty, onProfileLoaded, saveProfileNow } from "server/features/profile";
import { notify } from "server/lib/notify";
import { ensurePrompt, findNearbyTagged } from "server/lib/proximity";
import { fireClient, logAbuse, onClientRequest } from "server/lib/remotes";

const random = new Random();

// ---------------------------------------------------------------- platform policy

/** true = this player may open chests with Robux. Missing = not checked yet = not allowed. */
const robuxAllowed = new Map<Player, boolean>();

/**
 * Asks PolicyService whether paid random items are allowed for this player. If the call fails we treat the
 * player as restricted (fail closed): wrongly hiding a button is harmless, wrongly showing it breaks policy.
 */
function checkPolicy(player: Player): void {
	const [ok, info] = pcall(() => PolicyService.GetPolicyInfoForPlayerAsync(player));
	const restricted =
		!ok ||
		!typeIs(info, "table") ||
		(info as { ArePaidRandomItemsRestricted?: unknown }).ArePaidRandomItemsRestricted !== false;
	robuxAllowed.set(player, !restricted);
	fireClient(CHEST_POLICY_REMOTE, player, !restricted);
}

// ---------------------------------------------------------------- granting

/** Rolls and adds the item. The caller has already checked or charged. Returns undefined at the hard cap. */
function grantRoll(player: Player, data: ProfileData, chestId: ChestId): ItemId | undefined {
	const item = rollChest(chestId, random.NextNumber());
	const owned = addItem(data.inventory, data.nextUid, item);
	if (owned === undefined) {
		return undefined;
	}
	data.nextUid += 1;
	markDirty(player);
	fireClient(CHEST_RESULT_REMOTE, player, item, chestId);
	return item;
}

function handleOpenWithDollars(player: Player, args: Array<unknown>): void {
	const [chestId] = args;
	if (args.size() !== 1 || !isChestId(chestId)) {
		logAbuse(player, "bad OpenChest arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	const atChest = findNearbyTagged(
		player,
		TAGS.Chest,
		CHEST_DISTANCE,
		(i) => i.GetAttribute(ATTRIBUTES.ChestId) === chestId,
	);
	if (atChest === undefined) {
		logAbuse(player, "OpenChest away from the chest");
		return;
	}
	const check = canOpenWithDollars(chestId, data.money, data.inventory.size());
	if (!check.ok) {
		notify(player, check.reason === "money" ? "Не вистачає грошей." : "Інвентар повний: прибери щось.", "error");
		return;
	}
	// Charge and grant in the same frame: no yield in between, so no way to get one without the other.
	data.money -= CHESTS[chestId].dollarPrice;
	grantRoll(player, data, chestId);
}

// ---------------------------------------------------------------- Robux

function chestForProduct(productId: number): ChestId | undefined {
	return CHEST_IDS.find((id) => CHESTS[id].robuxProductId === productId);
}

const SAVE_TIMEOUT_SECONDS = 15;

/**
 * Roblox calls this for every Developer Product purchase, possibly more than once for the same receipt.
 * Rules: grant exactly once per PurchaseId, save before saying "granted", and never grant a random item to a
 * player whose policy forbids it (we leave the receipt unprocessed instead; see docs/chests.md).
 */
function processReceipt(receipt: ReceiptInfo): Enum.ProductPurchaseDecision {
	const player = Players.GetPlayerByUserId(receipt.PlayerId);
	const data = player === undefined ? undefined : getProfileData(player);
	const chestId = chestForProduct(receipt.ProductId);
	if (player === undefined || data === undefined || chestId === undefined) {
		return Enum.ProductPurchaseDecision.NotProcessedYet;
	}
	if (wasGranted(data.purchaseIds, receipt.PurchaseId)) {
		// Granted earlier; only the confirmation was lost. Make sure it is saved, then confirm.
		return saveProfileNow(player, SAVE_TIMEOUT_SECONDS)
			? Enum.ProductPurchaseDecision.PurchaseGranted
			: Enum.ProductPurchaseDecision.NotProcessedYet;
	}
	if (robuxAllowed.get(player) !== true) {
		notify(player, "Відкриття скринь за Robux недоступне для твого акаунта.", "error");
		return Enum.ProductPurchaseDecision.NotProcessedYet;
	}
	// The receipt id is recorded together with the item, in the same frame: a retry sees it and grants nothing.
	rememberPurchase(data.purchaseIds, receipt.PurchaseId);
	const item = grantRoll(player, data, chestId);
	if (item === undefined) {
		notify(player, "Інвентар переповнений. Звільни місце: покупку буде видано пізніше.", "error");
		data.purchaseIds.remove(data.purchaseIds.indexOf(receipt.PurchaseId));
		return Enum.ProductPurchaseDecision.NotProcessedYet;
	}
	return saveProfileNow(player, SAVE_TIMEOUT_SECONDS)
		? Enum.ProductPurchaseDecision.PurchaseGranted
		: Enum.ProductPurchaseDecision.NotProcessedYet;
}

// ---------------------------------------------------------------- lifecycle

export function startChestsService(): void {
	onClientRequest(OPEN_CHEST_REMOTE, new RateLimiter(3, 1), handleOpenWithDollars);
	MarketplaceService.ProcessReceipt = processReceipt;

	const addPrompt = (instance: Instance) => {
		const chestId = instance.GetAttribute(ATTRIBUTES.ChestId);
		if (isChestId(chestId)) {
			ensurePrompt(instance, "Подивитись", CHESTS[chestId].name);
		} else {
			warn(`[chests] ${instance.GetFullName()} has tag Chest but no valid ChestId attribute; skipped.`);
		}
	};
	CollectionService.GetTagged(TAGS.Chest).forEach(addPrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.Chest).Connect(addPrompt);

	onProfileLoaded((player) => task.spawn(checkPolicy, player));
	Players.PlayerRemoving.Connect((player) => robuxAllowed.delete(player));
}
