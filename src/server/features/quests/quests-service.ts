// Quests on the server (decision 055). Other features report what happened (trackQuest); the player claims rewards
// through one remote. Progress is never sent by the client: it only names which reward to claim.
import { QuestEventKind, QuestReward } from "shared/config/quests";
import { text } from "shared/features/i18n";
import { ProfileData } from "shared/features/profile";
import {
	CLAIM_QUEST_REMOTE,
	ClaimResult,
	QuestSnapshot,
	claimAllDone,
	claimChain,
	claimDaily,
	claimStreak,
	dayOf,
	isClaimWhat,
	recordEvent,
	rollOver,
	streakReward,
} from "shared/features/quests";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { MAX_COUNTER } from "shared/lib/repair";
import { getLoadedPlayers, getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
import { notify } from "server/lib/notify";
import { logAbuse, onClientRequest } from "server/lib/remotes";

/** How often a new day is checked for players who stay online over midnight (UTC). */
const ROLLOVER_CHECK_SECONDS = 30;

const random = new Random();
const roll = () => random.NextNumber();

function today(): number {
	return dayOf(os.time());
}

function snapshotOf(data: ProfileData): QuestSnapshot {
	let drills = 0;
	for (const [, drill] of pairs(data.drills)) {
		if (drill !== undefined) {
			drills += 1;
		}
	}
	return {
		machines: data.line.machines.size(),
		deepestLayer: data.deepestLayer,
		ownedGear: data.gear.owned,
		beltLevel: data.line.beltLevel,
		drills,
	};
}

/**
 * Counts an event for this player's quests (e.g. trackQuest(player, "mineOre", 3, "copper")). Cheap, never throws,
 * safe to call from any feature after the value already moved.
 */
export function trackQuest(player: Player, kind: QuestEventKind, amount: number, ore?: string): void {
	const data = getProfileData(player);
	if (data !== undefined && recordEvent(data.quests, kind, amount, ore)) {
		markDirty(player);
	}
}

function pay(player: Player, data: ProfileData, reward: QuestReward): void {
	const money = reward.money ?? 0;
	const crystals = reward.crystals ?? 0;
	// Money and crystals are added in the same frame as the quest is marked claimed: no yield, no double claim.
	data.money = math.min(data.money + money, MAX_COUNTER);
	data.crystals = math.min(data.crystals + crystals, MAX_COUNTER);
	markDirty(player);
	notify(player, text("quests.claimed", { money: formatMoney(money), crystals }), "success");
}

function handleClaim(player: Player, args: Array<unknown>): void {
	const [what, index] = args;
	if (args.size() < 1 || args.size() > 2 || !isClaimWhat(what)) {
		logAbuse(player, "bad ClaimQuest arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	rollOver(data.quests, today(), roll);
	let result: ClaimResult;
	if (what === "daily") {
		result = claimDaily(data.quests, index, snapshotOf(data), data.deepestLayer);
	} else if (what === "allDone") {
		result = claimAllDone(data.quests);
	} else if (what === "chain") {
		result = claimChain(data.quests, snapshotOf(data));
	} else {
		result = claimStreak(data.quests, today());
	}
	if (result.ok) {
		pay(player, data, result.reward);
	} else if (result.reason === "unknown") {
		logAbuse(player, "ClaimQuest of a quest that does not exist");
	}
	// "not-done" and "claimed" happen with a stale panel or a double tap: silently ignored.
}

function onLoaded(player: Player): void {
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	if (rollOver(data.quests, today(), roll)) {
		markDirty(player);
	}
	if (data.quests.streakClaimedDay !== today() && data.quests.streak >= 1) {
		const reward = streakReward(data.quests.streak);
		notify(player, text("quests.streakReady", { day: data.quests.streak, crystals: reward.crystals ?? 0 }), "info");
	}
}

export function startQuestsService(): void {
	onClientRequest(CLAIM_QUEST_REMOTE, new RateLimiter(6, 3), handleClaim);
	onProfileLoaded(onLoaded);
	task.spawn(() => {
		for (;;) {
			task.wait(ROLLOVER_CHECK_SECONDS);
			const day = today();
			for (const player of getLoadedPlayers()) {
				const [ok, err] = pcall(() => {
					const data = getProfileData(player);
					if (data !== undefined && rollOver(data.quests, day, roll)) {
						markDirty(player);
						notify(player, text("quests.newDay"), "info");
					}
				});
				if (!ok) {
					warn(`[quests] rollover failed for ${player.UserId}: ${err}`);
				}
			}
		}
	});
}
