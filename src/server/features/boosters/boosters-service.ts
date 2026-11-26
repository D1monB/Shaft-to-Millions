// Boosters on the server (decision 057): buying a portion with crystals, granting from the store or quests, and the
// multipliers that selling, the line and mining ask for. The end times live in the profile, so a boost survives a
// rejoin and a server change.
import { BOOSTERS, BoosterId, CRYSTAL_PORTION_SECONDS, isBoosterId } from "shared/config/boosters";
import { text } from "shared/features/i18n";
import { ProfileData } from "shared/features/profile";
import { BUY_BOOST_REMOTE, addBoost, boostMultiplier } from "shared/features/boosters";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";
import { logAbuse, onClientRequest } from "server/lib/remotes";

/** What a booster multiplies by for this player right now (1 when off or not loaded). */
export function boostOf(player: Player, id: BoosterId): number {
	const data = getProfileData(player);
	return data === undefined ? 1 : boostMultiplier(data.boosts, id, os.time());
}

/** Adds time to a booster. Returns the seconds added (0 when the booster is already at its cap). */
export function grantBoost(player: Player, data: ProfileData, id: BoosterId, seconds: number): number {
	const added = addBoost(data.boosts, id, seconds, os.time());
	if (added > 0) {
		markDirty(player);
	}
	return added;
}

let portionBonusOf: (player: Player) => number = () => 0;

/** The base's lab adds seconds to each crystal portion (decision 063). */
export function setBoostPortionBonusProvider(provider: (player: Player) => number): void {
	portionBonusOf = provider;
}

function handleBuy(player: Player, args: Array<unknown>): void {
	const [id] = args;
	if (args.size() !== 1 || !isBoosterId(id)) {
		logAbuse(player, "bad BuyBoost arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	const price = BOOSTERS[id].crystalPrice;
	if (!(data.crystals >= price)) {
		notify(player, text("boost.notEnoughCrystals"), "error");
		return;
	}
	// Charge only for time that was really added; a full booster costs nothing. No yield between the two writes.
	const portion = CRYSTAL_PORTION_SECONDS + math.max(0, portionBonusOf(player));
	if (grantBoost(player, data, id, portion) <= 0) {
		notify(player, text("boost.full"), "info");
		return;
	}
	data.crystals -= price;
	markDirty(player);
	notify(player, text("boost.started", { minutes: math.floor(portion / 60) }), "success");
}

export function startBoostersService(): void {
	onClientRequest(BUY_BOOST_REMOTE, new RateLimiter(4, 2), handleBuy);
}
