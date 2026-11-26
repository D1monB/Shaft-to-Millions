import { text } from "shared/features/i18n";
import { CollectionService } from "@rbxts/services";
import { TAGS } from "shared/config/map-contract";
import { ORES, ORE_IDS } from "shared/config/ores";
import { SALE_MADE_REMOTE, SELL_BAG_REMOTE, SELL_DISTANCE, previewSale } from "shared/features/selling";
import { SELL_QUEST_MIN_ITEMS } from "shared/config/quests";
import { RateLimiter } from "shared/lib/rate-limiter";
import { MAX_COUNTER } from "shared/lib/repair";
import { formatMoney } from "shared/lib/format";
import { getProfileData, markDirty } from "server/features/profile";
import { boostOf } from "server/features/boosters";
import { trackQuest } from "server/features/quests";
import { notify } from "server/lib/notify";
import { ensurePrompt, findNearbyTagged } from "server/lib/proximity";
import { declareClientEvent, fireClient, logAbuse, onClientRequest } from "server/lib/remotes";

let sellMultiplierOf: (player: Player) => number = () => 1;

/** Lets the equipment feature apply pet bonuses without selling depending on it. */
export function setSellMultiplierProvider(provider: (player: Player) => number): void {
	sellMultiplierOf = provider;
}

let baseSellOf: (player: Player) => number = () => 0;

/** The base's market bonus (decision 063), without selling depending on the base. */
export function setBaseSellProvider(provider: (player: Player) => number): void {
	baseSellOf = provider;
}

/** The sell multiplier (pets x market x money booster). Line income uses the same bonus as the sell zone. */
export function getSellMultiplier(player: Player): number {
	return sellMultiplierOf(player) * (1 + baseSellOf(player)) * boostOf(player, "money");
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
	const preview = previewSale(data.bag, ORE_IDS, ORES, getSellMultiplier(player));
	if (preview.itemCount === 0) {
		notify(player, text("sell.bagEmpty"), "info");
		return;
	}
	// Empty the bag and pay in the same frame, with no yield in between: the sale is atomic.
	for (const line of preview.lines) {
		data.bag[line.id as keyof typeof data.bag] = undefined;
	}
	data.money = math.min(data.money + preview.total, MAX_COUNTER);
	data.stats.totalEarned = math.min(data.stats.totalEarned + preview.total, MAX_COUNTER);
	markDirty(player);
	notify(player, text("sell.sold", { count: preview.itemCount, money: formatMoney(preview.total) }), "success");
	// A one-piece sale does not count for "sell your bag" quests, or six clicks would finish them.
	if (preview.itemCount >= SELL_QUEST_MIN_ITEMS) {
		trackQuest(player, "sellBag", 1);
	}
	trackQuest(player, "earnMoney", preview.total);
	fireClient(SALE_MADE_REMOTE, player, preview.total);
}

export function startSellingService(): void {
	declareClientEvent(SALE_MADE_REMOTE);
	onClientRequest(SELL_BAG_REMOTE, new RateLimiter(3, 1), handleSell);
	const addPrompt = (zone: Instance) => ensurePrompt(zone, text("common.sell"), text("sell.title"));
	CollectionService.GetTagged(TAGS.SellZone).forEach(addPrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.SellZone).Connect(addPrompt);
}
