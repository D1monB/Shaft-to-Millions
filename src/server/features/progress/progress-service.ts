// Calendar, rebirth, titles, the friend bonus and the live-event announcement on the server (decision 070).
// Every value is checked and moved here; the client only asks.
import { Players, Workspace } from "@rbxts/services";
import { text } from "shared/features/i18n";
import { ProfileData, createDefaultProfileData } from "shared/features/profile";
import {
	CLAIM_CALENDAR_REMOTE,
	CLOSE_GUIDE_REMOTE,
	FRIEND_BONUS_ATTRIBUTE,
	REBIRTH_REMOTE,
	REBIRTH_REWARD_CRYSTALS,
	SET_TITLE_REMOTE,
	TITLE_ATTRIBUTE,
	calendarReward,
	canRebirth,
	claimCalendarDay,
	findAchievement,
	friendBonus,
	isUnlocked,
	liveBonuses,
	liveEventAt,
	rebirthMultiplier,
	statsOfProfile,
} from "shared/features/progress";
import { dayOf } from "shared/features/quests";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { MAX_COUNTER } from "shared/lib/repair";
import { grantBoost } from "server/features/boosters";
import { rebuildPlot } from "server/features/line";
import { getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
import { setProgressSellProvider } from "server/features/selling";
import { syncPickaxeTool } from "server/features/upgrades";
import { notify } from "server/lib/notify";
import { logAbuse, onClientRequest } from "server/lib/remotes";

/** Workspace attribute: the live event running now ("" for none), so every client shows the same banner. */
export const LIVE_EVENT_ATTRIBUTE = "LiveEvent";

const friends = new Map<Player, Set<number>>();

function noArgs(name: string, handler: (player: Player, data: ProfileData) => void) {
	return (player: Player, args: Array<unknown>) => {
		if (args.size() !== 0) {
			logAbuse(player, `bad ${name} arguments`);
			return;
		}
		const data = getProfileData(player);
		if (data !== undefined) {
			handler(player, data);
		}
	};
}

function claimCalendar(player: Player, data: ProfileData): void {
	const day = claimCalendarDay(data.calendar, dayOf(os.time()));
	if (day === undefined) {
		return;
	}
	const reward = calendarReward(day, data.deepestLayer);
	// Day marked and paid in the same frame.
	data.money = math.min(data.money + reward.money, MAX_COUNTER);
	data.crystals = math.min(data.crystals + reward.crystals, MAX_COUNTER);
	for (const id of reward.boosters) {
		grantBoost(player, data, id, reward.boosterSeconds);
	}
	markDirty(player);
	notify(
		player,
		text("calendar.claimed", { day, money: formatMoney(reward.money), crystals: reward.crystals }),
		"success",
	);
}

/** Everything a rebirth wipes. Crystals, items, the base, quests, the calendar and settings stay. */
function resetForRebirth(data: ProfileData): void {
	const fresh = createDefaultProfileData();
	data.money = 0;
	data.bag = fresh.bag;
	data.gear = fresh.gear;
	data.line = fresh.line;
	data.drills = fresh.drills;
	data.deepestLayer = fresh.deepestLayer;
}

function rebirth(player: Player, data: ProfileData): void {
	if (!canRebirth(data.rebirths, data.money)) {
		notify(player, text("rebirth.notReady"), "error");
		return;
	}
	resetForRebirth(data);
	data.rebirths += 1;
	data.crystals = math.min(data.crystals + REBIRTH_REWARD_CRYSTALS, MAX_COUNTER);
	markDirty(player);
	rebuildPlot(player);
	syncPickaxeTool(player);
	// A title earned by machines may not be earned any more.
	publishTitle(player, data);
	notify(
		player,
		text("rebirth.done", { value: rebirthMultiplier(data.rebirths), crystals: REBIRTH_REWARD_CRYSTALS }),
		"success",
	);
	for (const other of Players.GetPlayers()) {
		if (other !== player) {
			notify(other, text("rebirth.announce", { name: player.DisplayName }), "info");
		}
	}
}

/** The title is shown only while its achievement is really unlocked. */
function publishTitle(player: Player, data: ProfileData): void {
	const achievement = findAchievement(data.title);
	const shown =
		achievement !== undefined && isUnlocked(achievement, statsOfProfile(data)) ? achievement.id : undefined;
	player.SetAttribute(TITLE_ATTRIBUTE, shown);
}

function setTitle(player: Player, args: Array<unknown>): void {
	const [id] = args;
	const data = getProfileData(player);
	const achievement = findAchievement(id);
	if (args.size() !== 1 || (id !== "" && achievement === undefined)) {
		logAbuse(player, "bad SetTitle arguments");
		return;
	}
	if (data === undefined) {
		return;
	}
	if (achievement !== undefined && !isUnlocked(achievement, statsOfProfile(data))) {
		logAbuse(player, "SetTitle of a locked title");
		return;
	}
	data.title = achievement?.id ?? "";
	markDirty(player);
	publishTitle(player, data);
}

// ---- friends ----

function refreshFriendBonus(): void {
	for (const player of Players.GetPlayers()) {
		const count = friends.get(player)?.size() ?? 0;
		player.SetAttribute(FRIEND_BONUS_ATTRIBUTE, friendBonus(count));
	}
}

/** Finds out who on this server is a friend of the newcomer. The web call may fail: then no bonus yet. */
function linkFriends(player: Player): void {
	for (const other of Players.GetPlayers()) {
		if (other === player) {
			continue;
		}
		const [ok, isFriend] = pcall(() => player.IsFriendsWithAsync(other.UserId as unknown as User));
		if (ok && isFriend === true && player.Parent !== undefined && other.Parent !== undefined) {
			for (const [a, b] of [
				[player, other],
				[other, player],
			] as Array<[Player, Player]>) {
				let list = friends.get(a);
				if (list === undefined) {
					list = new Set();
					friends.set(a, list);
				}
				list.add(b.UserId);
			}
		}
	}
	refreshFriendBonus();
}

function forgetFriend(player: Player): void {
	friends.delete(player);
	for (const [, list] of friends) {
		list.delete(player.UserId);
	}
	refreshFriendBonus();
}

export function startProgressService(): void {
	onClientRequest(CLAIM_CALENDAR_REMOTE, new RateLimiter(3, 1), noArgs("ClaimCalendar", claimCalendar));
	onClientRequest(REBIRTH_REMOTE, new RateLimiter(2, 0.2), noArgs("Rebirth", rebirth));
	onClientRequest(SET_TITLE_REMOTE, new RateLimiter(6, 2), setTitle);
	onClientRequest(
		CLOSE_GUIDE_REMOTE,
		new RateLimiter(2, 0.5),
		noArgs("CloseGuide", (player, data) => {
			data.guideClosed = true;
			markDirty(player);
		}),
	);
	// Friends pay inside the sell cap; rebirths and a gold week multiply on top of it.
	setProgressSellProvider((player) => {
		const data = getProfileData(player);
		const friendAttribute = player.GetAttribute(FRIEND_BONUS_ATTRIBUTE);
		return {
			capped: 1 + (typeIs(friendAttribute, "number") ? friendAttribute : 0),
			uncapped: rebirthMultiplier(data?.rebirths ?? 0) * liveBonuses(liveEventAt(os.time())).money,
		};
	});
	onProfileLoaded((player) => {
		const data = getProfileData(player);
		if (data !== undefined) {
			publishTitle(player, data);
		}
	});
	Players.PlayerAdded.Connect((player) => task.spawn(linkFriends, player));
	Players.GetPlayers().forEach((player) => task.spawn(linkFriends, player));
	Players.PlayerRemoving.Connect(forgetFriend);
	task.spawn(() => {
		for (;;) {
			Workspace.SetAttribute(LIVE_EVENT_ATTRIBUTE, liveEventAt(os.time()) ?? "");
			task.wait(60);
		}
	});
}
