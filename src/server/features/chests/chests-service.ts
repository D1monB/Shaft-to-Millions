// Chests: opening with crystals (at a chest stand, decision 043) and with Robux (Developer Products via ProcessReceipt).
// Every roll happens here, on the server, with the server's Random.
import { nameKeys, text } from "shared/features/i18n";
import { CollectionService, Players, PolicyService } from "@rbxts/services";
import { CHESTS, CHEST_IDS, ChestId, isChestId } from "shared/config/chests";
import { ItemId } from "shared/config/items";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import {
	CHEST_DISTANCE,
	CHEST_RESULT_REMOTE,
	ROBUX_CHESTS_ALLOWED_ATTRIBUTE,
	OPEN_CHEST_REMOTE,
	addItem,
	canOpenWithCrystals,
	rollChest,
} from "shared/features/chests";
import { ProfileData } from "shared/features/profile";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
import { trackQuest } from "server/features/quests";
import { registerProduct } from "server/features/store";
import { notify } from "server/lib/notify";
import { ensurePrompt, findNearbyTagged } from "server/lib/proximity";
import { declareClientEvent, fireClient, logAbuse, onClientRequest } from "server/lib/remotes";

const random = new Random();

// ---------------------------------------------------------------- platform policy

/** true = this player may open chests with Robux. Missing = not checked yet = not allowed. */
const robuxAllowed = new Map<Player, boolean>();

const POLICY_ATTEMPTS = 3;

/**
 * Asks PolicyService whether paid random items are allowed for this player, with a few retries because the
 * call can fail transiently. If it still fails, the player is treated as restricted (fail closed): wrongly
 * hiding a button is harmless, wrongly showing it breaks policy.
 * The result is published as a Player attribute: it replicates to the client whenever the client is ready,
 * so there is no race with the client's UI starting up. Clients cannot change a server-set attribute.
 */
function checkPolicy(player: Player): void {
	let allowed = false;
	for (let attempt = 1; attempt <= POLICY_ATTEMPTS; attempt++) {
		const [ok, info] = pcall(() => PolicyService.GetPolicyInfoForPlayerAsync(player));
		if (ok && typeIs(info, "table")) {
			allowed = (info as { ArePaidRandomItemsRestricted?: unknown }).ArePaidRandomItemsRestricted === false;
			break;
		}
		task.wait(2 * attempt);
	}
	if (player.Parent === undefined) {
		return;
	}
	robuxAllowed.set(player, allowed);
	player.SetAttribute(ROBUX_CHESTS_ALLOWED_ATTRIBUTE, allowed);
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
	trackQuest(player, "openChest", 1);
	fireClient(CHEST_RESULT_REMOTE, player, item, chestId);
	return item;
}

function handleOpenWithCrystals(player: Player, args: Array<unknown>): void {
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
	const check = canOpenWithCrystals(chestId, data.crystals, data.inventory.size());
	if (!check.ok) {
		notify(
			player,
			check.reason === "crystals" ? text("common.notEnoughCrystals") : text("chest.inventoryFull"),
			"error",
		);
		return;
	}
	// Charge and grant in the same frame: no yield in between, so no way to get one without the other.
	data.crystals -= CHESTS[chestId].crystalPrice;
	grantRoll(player, data, chestId);
}

// ---------------------------------------------------------------- Robux

/**
 * Chest products go through the store's single ProcessReceipt (decision 057). `random: true`: never granted to a
 * player whose policy forbids paid random items (the receipt stays unprocessed; see docs/chests.md).
 */
function registerChestProducts(): void {
	for (const chestId of CHEST_IDS) {
		const productId = CHESTS[chestId].robuxProductId;
		if (productId !== undefined) {
			registerProduct(productId, {
				random: true,
				grant: (player, data) => grantRoll(player, data, chestId) !== undefined,
			});
		}
	}
}

// ---------------------------------------------------------------- lifecycle

export function startChestsService(): void {
	declareClientEvent(CHEST_RESULT_REMOTE);
	onClientRequest(OPEN_CHEST_REMOTE, new RateLimiter(3, 1), handleOpenWithCrystals);
	registerChestProducts();

	const addPrompt = (instance: Instance) => {
		const chestId = instance.GetAttribute(ATTRIBUTES.ChestId);
		if (isChestId(chestId)) {
			// A bit shorter than the server check (CHEST_DISTANCE), so a prompt the engine shows always passes it.
			ensurePrompt(instance, text("common.view"), text(nameKeys.chest(chestId)), CHEST_DISTANCE - 2);
		} else {
			warn(`[chests] ${instance.GetFullName()} has tag Chest but no valid ChestId attribute; skipped.`);
		}
	};
	CollectionService.GetTagged(TAGS.Chest).forEach(addPrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.Chest).Connect(addPrompt);

	onProfileLoaded((player) => task.spawn(checkPolicy, player));
	Players.PlayerRemoving.Connect((player) => robuxAllowed.delete(player));
}
