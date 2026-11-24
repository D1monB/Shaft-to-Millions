import { CollectionService } from "@rbxts/services";
import { TAGS } from "shared/config/map-contract";
import { ORES, ORE_IDS } from "shared/config/ores";
import { SELL_BAG_REMOTE, SELL_DISTANCE, previewSale } from "shared/features/selling";
import { RateLimiter } from "shared/lib/rate-limiter";
import { formatMoney } from "shared/lib/format";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";
import { ensurePrompt, findNearbyTagged } from "server/lib/proximity";
import { logAbuse, onClientRequest } from "server/lib/remotes";

let sellMultiplierOf: (player: Player) => number = () => 1;

/** Lets the equipment feature apply pet bonuses without selling depending on it. */
export function setSellMultiplierProvider(provider: (player: Player) => number): void {
	sellMultiplierOf = provider;
}

/** The sell multiplier (pets) for this player. Warehouse sales use the same bonus as the sell zone. */
export function getSellMultiplier(player: Player): number {
	return sellMultiplierOf(player);
}

function handleSell(player: Player, args: Array<unknown>): void {
	if (args.size() !== 0) {
		logAbuse(player, "bad SellBag arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	if (findNearbyTagged(player, TAGS.SellZone, SELL_DISTANCE) === undefined) {
		logAbuse(player, "SellBag away from a sell zone");
		return;
	}
	const preview = previewSale(data.bag, ORE_IDS, ORES, sellMultiplierOf(player));
	if (preview.itemCount === 0) {
		notify(player, "Сумка порожня.", "info");
		return;
	}
	// Empty the bag and pay in the same frame, with no yield in between: the sale is atomic.
	for (const line of preview.lines) {
		data.bag[line.id as keyof typeof data.bag] = undefined;
	}
	data.money += preview.total;
	data.stats.totalEarned += preview.total;
	markDirty(player);
	notify(player, `Продано ${preview.itemCount} шт. за ${formatMoney(preview.total)}!`, "success");
}

export function startSellingService(): void {
	onClientRequest(SELL_BAG_REMOTE, new RateLimiter(3, 1), handleSell);
	const addPrompt = (zone: Instance) => ensurePrompt(zone, "Продати", "Скупка руди");
	CollectionService.GetTagged(TAGS.SellZone).forEach(addPrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.SellZone).Connect(addPrompt);
}
