// The aura roll machine on the server (decision 064): checks, charges and rolls in one frame with the server Random,
// and sells spare duplicates in one click.
import { text } from "shared/features/i18n";
import { addItem } from "shared/features/chests";
import { sellDuplicates } from "shared/features/equipment";
import {
	SELL_DUPLICATES_REMOTE,
	SPIN_AURA_REMOTE,
	SPIN_RESULT_REMOTE,
	canSpin,
	isSpinPay,
	refreshSpins,
	spin,
} from "shared/features/aura-roll";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { MAX_COUNTER } from "shared/lib/repair";
import { getLoadedPlayers, getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
import { notify } from "server/lib/notify";
import { declareClientEvent, fireClient, logAbuse, onClientRequest } from "server/lib/remotes";

const random = new Random();

function handleSpin(player: Player, args: Array<unknown>): void {
	const [pay] = args;
	if (args.size() !== 1 || !isSpinPay(pay)) {
		logAbuse(player, "bad SpinAura arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	refreshSpins(data.auraRoll, os.time());
	const check = canSpin(data.auraRoll, pay, data.crystals, data.inventory.size());
	if (!check.ok) {
		if (check.reason === "inventory-full") {
			notify(player, text("aura.full"), "error");
		} else if (check.reason === "crystals") {
			notify(player, text("boost.notEnoughCrystals"), "error");
		}
		return;
	}
	const item = spin(data.auraRoll, random.NextNumber());
	if (addItem(data.inventory, data.nextUid, item) === undefined) {
		return;
	}
	// Charge only after the aura is in the inventory; no yield between the two.
	data.nextUid += 1;
	if (pay === "free") {
		data.auraRoll.spins -= 1;
	} else {
		data.crystals -= check.cost;
	}
	markDirty(player);
	fireClient(SPIN_RESULT_REMOTE, player, item);
}

function handleSellDuplicates(player: Player, args: Array<unknown>): void {
	if (args.size() !== 0) {
		logAbuse(player, "bad SellDuplicates arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	const sold = sellDuplicates(data.inventory, data.equipped);
	if (sold.count === 0) {
		notify(player, text("aura.noDuplicates"), "info");
		return;
	}
	data.money = math.min(data.money + sold.money, MAX_COUNTER);
	data.stats.totalEarned = math.min(data.stats.totalEarned + sold.money, MAX_COUNTER);
	markDirty(player);
	notify(player, text("aura.soldDuplicates", { count: sold.count, money: formatMoney(sold.money) }), "success");
}

export function startAuraRollService(): void {
	declareClientEvent(SPIN_RESULT_REMOTE);
	onClientRequest(SPIN_AURA_REMOTE, new RateLimiter(3, 0.8), handleSpin);
	onClientRequest(SELL_DUPLICATES_REMOTE, new RateLimiter(2, 0.5), handleSellDuplicates);
	onProfileLoaded((player) => {
		const data = getProfileData(player);
		if (data !== undefined && refreshSpins(data.auraRoll, os.time())) {
			markDirty(player);
		}
	});
	task.spawn(() => {
		for (;;) {
			task.wait(20);
			for (const player of getLoadedPlayers()) {
				const data = getProfileData(player);
				if (data !== undefined && refreshSpins(data.auraRoll, os.time())) {
					markDirty(player);
				}
			}
		}
	});
}
