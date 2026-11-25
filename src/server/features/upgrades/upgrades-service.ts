import { nameKeys, ref, text } from "shared/features/i18n";
import { CollectionService } from "@rbxts/services";
import { TAGS } from "shared/config/map-contract";
import {
	BUY_GEAR_REMOTE,
	EQUIP_GEAR_REMOTE,
	SHOP_DISTANCE,
	applyPurchase,
	findGear,
	tryBuyGear,
	tryEquipGear,
} from "shared/features/upgrades";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";
import { ensurePrompt, findNearbyTagged } from "server/lib/proximity";
import { logAbuse, onClientRequest } from "server/lib/remotes";

function handleBuy(player: Player, args: Array<unknown>): void {
	const [id] = args;
	if (args.size() !== 1 || findGear(id) === undefined) {
		logAbuse(player, "bad BuyGear arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	if (findNearbyTagged(player, TAGS.Shop, SHOP_DISTANCE) === undefined) {
		logAbuse(player, "BuyGear away from a shop");
		return;
	}

	const result = tryBuyGear(id, data.money, data.gear);
	if (result.ok) {
		// Money and ownership change in the same frame with no yield in between: the purchase is atomic.
		data.money = result.money;
		applyPurchase(result, data.gear);
		markDirty(player);
		notify(player, text("shop.bought", { name: ref(nameKeys.gear(result.def.id)) }), "success");
	} else if (result.reason === "not-enough-money") {
		notify(player, text("common.notEnoughMoney"), "error");
	}
	// "owned" (a double click) is silently ignored: the UI already shows the truth.
}

function handleEquip(player: Player, args: Array<unknown>): void {
	const [id] = args;
	const found = findGear(id);
	if (args.size() !== 1 || found === undefined) {
		logAbuse(player, "bad EquipGear arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	const result = tryEquipGear(id, data.gear);
	if (result.ok) {
		data.gear.equipped[result.slot] = found.def.id;
		markDirty(player);
	} else if (result.reason === "not-owned") {
		logAbuse(player, "EquipGear of an item not owned");
	}
}

export function startUpgradesService(): void {
	onClientRequest(BUY_GEAR_REMOTE, new RateLimiter(6, 3), handleBuy);
	onClientRequest(EQUIP_GEAR_REMOTE, new RateLimiter(6, 3), handleEquip);
	const addPrompt = (shop: Instance) => ensurePrompt(shop, text("common.open"), text("shop.title"));
	CollectionService.GetTagged(TAGS.Shop).forEach(addPrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.Shop).Connect(addPrompt);
}
