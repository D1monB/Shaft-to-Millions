import { CollectionService } from "@rbxts/services";
import { TAGS } from "shared/config/map-contract";
import {
	BUY_UPGRADE_REMOTE,
	SHOP_DISTANCE,
	UPGRADE_TRACKS,
	isUpgradeTrack,
	tryBuyUpgrade,
} from "shared/features/upgrades";
import { RateLimiter } from "shared/lib/rate-limiter";
import { isIntegerInRange } from "shared/lib/validate";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";
import { ensurePrompt, findNearbyTagged } from "server/lib/proximity";
import { logAbuse, onClientRequest } from "server/lib/remotes";

function handleBuy(player: Player, args: Array<unknown>): void {
	const [track, expectedLevel] = args;
	if (args.size() !== 2 || !isUpgradeTrack(track) || !isIntegerInRange(expectedLevel, 1, 1000)) {
		logAbuse(player, "bad BuyUpgrade arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	if (findNearbyTagged(player, TAGS.Shop, SHOP_DISTANCE) === undefined) {
		logAbuse(player, "BuyUpgrade away from a shop");
		return;
	}

	const result = tryBuyUpgrade(track, data.money, data.levels[track], expectedLevel);
	if (result.ok) {
		// Both writes happen in the same frame with no yield in between, so the purchase is atomic.
		data.money = result.money;
		data.levels[track] = result.level;
		markDirty(player);
		notify(player, `Куплено: ${UPGRADE_TRACKS[track][result.level - 1].name}!`, "success");
	} else if (result.reason === "not-enough-money") {
		notify(player, "Не вистачає грошей.", "error");
	}
	// "stale-request" (double click) and "max-level" are silently ignored: the UI already shows the truth.
}

export function startUpgradesService(): void {
	onClientRequest(BUY_UPGRADE_REMOTE, new RateLimiter(6, 3), handleBuy);
	const addPrompt = (shop: Instance) => ensurePrompt(shop, "Відкрити", "Магазин спорядження");
	CollectionService.GetTagged(TAGS.Shop).forEach(addPrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.Shop).Connect(addPrompt);
}
