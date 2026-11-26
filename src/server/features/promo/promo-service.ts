// Promo codes on the server (decision 068). Codes are stored in a DataStore only. A use is counted with UpdateAsync
// (safe across servers), the player's own list stops a second payout, and one redeem per player runs at a time.
import { DataStoreService, Players } from "@rbxts/services";
import {
	CREATE_CODE_REMOTE,
	DELETE_CODE_REMOTE,
	MAX_REDEEMED_CODES,
	PromoRecord,
	REDEEM_CODE_REMOTE,
	hasUsesLeft,
	newPromoRecord,
	normalizeCode,
	readPromoRecord,
} from "shared/features/promo";
import { text } from "shared/features/i18n";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { MAX_COUNTER } from "shared/lib/repair";
import { adminRoleOf } from "server/features/admin";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";
import { logAbuse, onClientRequest } from "server/lib/remotes";

const STORE_NAME = "PromoCodes_v1";
const busy = new Set<Player>();

function store(): DataStore {
	return DataStoreService.GetDataStore(STORE_NAME);
}

/** Takes one use of the code. Returns the record when a use was taken, undefined for unknown or used up. */
function takeUse(code: string): PromoRecord | undefined {
	let taken: PromoRecord | undefined;
	store().UpdateAsync(code, (old: unknown) => {
		taken = undefined;
		const record = readPromoRecord(old);
		if (record === undefined || !hasUsesLeft(record)) {
			// UpdateAsync is typed as returning a LuaTuple; this compiles to a plain `return nil` (cancels the write).
			// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple
			return [undefined] as unknown as LuaTuple<[PromoRecord | undefined]>; // cancels the write
		}
		record.uses += 1;
		taken = record;
		// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple
		return [record] as unknown as LuaTuple<[PromoRecord | undefined]>;
	});
	return taken;
}

function redeem(player: Player, code: string): void {
	const before = getProfileData(player);
	if (before === undefined) {
		return;
	}
	if (before.redeemedCodes.includes(code) || before.redeemedCodes.size() >= MAX_REDEEMED_CODES) {
		notify(player, text("promo.alreadyUsed"), "error");
		return;
	}
	const [ok, result] = pcall(takeUse, code);
	if (!ok) {
		warn(`[promo] redeem failed: ${result}`);
		notify(player, text("promo.tryLater"), "error");
		return;
	}
	const reward = result as PromoRecord | undefined;
	if (reward === undefined) {
		notify(player, text("promo.invalid"), "error");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return; // left while the store answered: that one use is lost, never paid twice
	}
	// Paid and remembered in the same frame.
	data.redeemedCodes.push(code);
	data.money = math.min(data.money + reward.money, MAX_COUNTER);
	data.crystals = math.min(data.crystals + reward.crystals, MAX_COUNTER);
	markDirty(player);
	notify(player, text("promo.redeemed", { money: formatMoney(reward.money), crystals: reward.crystals }), "success");
}

function handleRedeem(player: Player, args: Array<unknown>): void {
	if (args.size() !== 1 || !typeIs(args[0], "string")) {
		logAbuse(player, "bad RedeemCode arguments");
		return;
	}
	const code = normalizeCode(args[0]);
	if (code === undefined) {
		notify(player, text("promo.invalid"), "error");
		return;
	}
	if (busy.has(player)) {
		return;
	}
	busy.add(player);
	const [ok, err] = pcall(redeem, player, code);
	busy.delete(player);
	if (!ok) {
		warn(`[promo] redeem crashed: ${err}`);
	}
}

function handleCreate(player: Player, args: Array<unknown>): void {
	const [rawCode, money, crystals, maxUses] = args;
	if (adminRoleOf(player) !== "owner") {
		logAbuse(player, "CreateCode by a non-owner");
		return;
	}
	const code = normalizeCode(rawCode);
	const record = newPromoRecord(money, crystals, maxUses);
	if (args.size() !== 4 || code === undefined || record === undefined) {
		notify(player, text("promo.badInput"), "error");
		return;
	}
	const [ok, err] = pcall(() => store().SetAsync(code, record));
	if (!ok) {
		warn(`[promo] create failed: ${err}`);
		notify(player, text("promo.tryLater"), "error");
		return;
	}
	warn(`[promo] ${player.UserId} created a code`);
	notify(player, text("promo.created", { code }), "success");
}

function handleDelete(player: Player, args: Array<unknown>): void {
	if (adminRoleOf(player) !== "owner") {
		logAbuse(player, "DeleteCode by a non-owner");
		return;
	}
	const code = normalizeCode(args[0]);
	if (args.size() !== 1 || code === undefined) {
		notify(player, text("promo.badInput"), "error");
		return;
	}
	const [ok, err] = pcall(() => store().RemoveAsync(code));
	if (!ok) {
		warn(`[promo] delete failed: ${err}`);
		notify(player, text("promo.tryLater"), "error");
		return;
	}
	notify(player, text("promo.deleted", { code }), "success");
}

export function startPromoService(): void {
	// Slow on purpose: guessing codes by spamming gets nowhere.
	onClientRequest(REDEEM_CODE_REMOTE, new RateLimiter(3, 0.25), handleRedeem);
	onClientRequest(CREATE_CODE_REMOTE, new RateLimiter(4, 1), handleCreate);
	onClientRequest(DELETE_CODE_REMOTE, new RateLimiter(4, 1), handleDelete);
	Players.PlayerRemoving.Connect((player) => busy.delete(player));
}
