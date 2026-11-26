import { nameKeys, ref, text } from "shared/features/i18n";
import { CollectionService } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import {
	BUY_GEAR_REMOTE,
	EQUIP_GEAR_REMOTE,
	FoundGear,
	SHOP_DISTANCE,
	applyPurchase,
	findGear,
	shopSells,
	shopSlotOf,
	tryBuyGear,
	tryEquipGear,
} from "shared/features/upgrades";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";
import { ensurePrompt, findNearbyTagged } from "server/lib/proximity";
import { logAbuse, onClientRequest } from "server/lib/remotes";
import { ensureGearShops } from "./gear-shops";
import { startPickaxeTools, syncPickaxeTool } from "./pickaxe-tools";

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
	// Gear is bought at its own stand (decision 058): a pickaxe at the pickaxe shop, and so on. Not logged as abuse: an
	// honest player can walk away while the panel is open.
	const slot = (findGear(id) as FoundGear).slot; // checked above: findGear(id) is not undefined
	const shop = findNearbyTagged(player, TAGS.Shop, SHOP_DISTANCE, (stand) =>
		shopSells(shopSlotOf(stand.GetAttribute(ATTRIBUTES.ShopSlot)), slot),
	);
	if (shop === undefined) {
		notify(player, text("shop.goToShop"), "error");
		return;
	}
	const result = tryBuyGear(id, data.money, data.gear);
	if (result.ok) {
		// Money and ownership change in the same frame with no yield in between: the purchase is atomic.
		data.money = result.money;
		applyPurchase(result, data.gear);
		markDirty(player);
		syncPickaxeTool(player);
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
		syncPickaxeTool(player);
	} else if (result.reason === "not-owned") {
		logAbuse(player, "EquipGear of an item not owned");
	}
}

export function startUpgradesService(): void {
	onClientRequest(BUY_GEAR_REMOTE, new RateLimiter(6, 3), handleBuy);
	onClientRequest(EQUIP_GEAR_REMOTE, new RateLimiter(6, 3), handleEquip);
	startPickaxeTools();
	ensureGearShops();
	// A bit shorter than the server check (SHOP_DISTANCE), so a prompt the engine shows always passes it.
	const addPrompt = (shop: Instance) =>
		ensurePrompt(shop, text("common.open"), text("shop.title"), SHOP_DISTANCE - 4);
	CollectionService.GetTagged(TAGS.Shop).forEach(addPrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.Shop).Connect(addPrompt);
}
