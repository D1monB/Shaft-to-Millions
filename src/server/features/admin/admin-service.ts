// The developer panel on the server (decision 068). Every action is checked against the SENDER's role, which comes
// from their UserId or from their own saved profile, never from anything the client says. Money given here does not
// count as earned, so it cannot push anyone up the wealth board. Every action is logged with user ids only.
import { Players } from "@rbxts/services";
import {
	ADMIN_ACTION_REMOTE,
	ADMIN_ROLE_ATTRIBUTE,
	AdminRequest,
	AdminRole,
	isAllowed,
	parseAdminRequest,
	roleOf,
} from "shared/features/admin";
import { BOOSTER_IDS } from "shared/config/boosters";
import { MAX_FREE_SPINS } from "shared/config/aura-roll";
import { LAYER_COUNT } from "shared/config/layers";
import { resetProfile } from "shared/features/devtools";
import { text } from "shared/features/i18n";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { MAX_COUNTER } from "shared/lib/repair";
import { grantBoost } from "server/features/boosters";
import { teleportCharacter } from "server/features/movement";
import { getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
import { notify } from "server/lib/notify";
import { getRootPosition } from "server/lib/proximity";
import { logAbuse, onClientRequest } from "server/lib/remotes";

const GIFT_BOOST_SECONDS = 30 * 60;

export function adminRoleOf(player: Player): AdminRole | undefined {
	return roleOf(player.UserId, getProfileData(player)?.devRole === true);
}

function publishRole(player: Player): void {
	player.SetAttribute(ADMIN_ROLE_ATTRIBUTE, adminRoleOf(player));
}

/** Does the action. Returns false when the target cannot take it right now. */
function perform(actor: Player, target: Player, request: AdminRequest): boolean {
	if (request.action === "kick") {
		target.Kick("Removed by a game developer.");
		return true;
	}
	if (request.action === "bring" || request.action === "goto") {
		const [mover, anchor] = request.action === "bring" ? [target, actor] : [actor, target];
		const spot = getRootPosition(anchor);
		if (spot === undefined || getRootPosition(mover) === undefined) {
			return false;
		}
		teleportCharacter(mover, spot.add(new Vector3(4, 1, 0)));
		return true;
	}
	if (request.action === "heal") {
		const humanoid = target.Character?.FindFirstChildOfClass("Humanoid");
		if (humanoid === undefined || humanoid.Health <= 0) {
			return false;
		}
		humanoid.Health = humanoid.MaxHealth;
		return true;
	}
	const data = getProfileData(target);
	if (data === undefined) {
		return false;
	}
	if (request.action === "money") {
		data.money = math.min(data.money + request.amount, MAX_COUNTER);
		notify(target, text("admin.gotMoney", { money: formatMoney(request.amount) }), "success");
		markDirty(target);
	} else if (request.action === "crystals") {
		data.crystals = math.min(data.crystals + request.amount, MAX_COUNTER);
		notify(target, text("admin.gotCrystals", { count: request.amount }), "success");
		markDirty(target);
	} else if (request.action === "takeMoney") {
		// Never below zero: a balance is never negative.
		data.money = math.max(data.money - request.amount, 0);
		notify(target, text("admin.tookMoney", { money: formatMoney(request.amount) }), "error");
		markDirty(target);
	} else if (request.action === "takeCrystals") {
		data.crystals = math.max(data.crystals - request.amount, 0);
		notify(target, text("admin.tookCrystals", { count: request.amount }), "error");
		markDirty(target);
	} else if (request.action === "unlock") {
		data.deepestLayer = LAYER_COUNT;
		markDirty(target);
	} else if (request.action === "boost") {
		for (const id of BOOSTER_IDS) {
			grantBoost(target, data, id, GIFT_BOOST_SECONDS);
		}
		notify(target, text("store.boostGranted"), "success");
	} else if (request.action === "spins") {
		data.auraRoll.spins = MAX_FREE_SPINS;
		markDirty(target);
	} else if (request.action === "reset") {
		// The kick releases the session, which saves the fresh profile; rejoining builds everything anew.
		resetProfile(data);
		markDirty(target);
		target.Kick("Your progress was reset by the game owner. Rejoin to start again.");
	} else {
		data.devRole = request.action === "grant";
		markDirty(target);
		publishRole(target);
		notify(target, text(data.devRole ? "admin.gotRole" : "admin.lostRole"), "info");
	}
	return true;
}

function handle(player: Player, args: Array<unknown>): void {
	const request = parseAdminRequest(args);
	if (request === undefined || !isAllowed(adminRoleOf(player), player.UserId, request)) {
		logAbuse(player, "AdminAction refused");
		return;
	}
	const target = Players.GetPlayerByUserId(request.targetId);
	if (target === undefined || !perform(player, target, request)) {
		notify(player, text("admin.noTarget"), "error");
		return;
	}
	warn(`[admin] ${player.UserId} ${request.action} ${request.amount} -> ${request.targetId}`);
	notify(player, text("dev.done"), "success");
}

export function startAdminService(): void {
	onClientRequest(ADMIN_ACTION_REMOTE, new RateLimiter(8, 3), handle);
	onProfileLoaded(publishRole);
}
