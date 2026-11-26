// Base upgrades on the server (decision 063, menu only since 067): starting builds, timers (also while offline, by
// unix time), skipping with crystals, builders, and the bonuses other features ask for.
import { isBuildingId } from "shared/config/base";
import {
	BaseEffects,
	HIRE_BUILDER_REMOTE,
	SKIP_BUILD_REMOTE,
	START_BUILD_REMOTE,
	applySkip,
	applyStart,
	baseEffects,
	completeJobs,
	levelOf,
	tryHireBuilder,
	trySkip,
	tryStartBuild,
} from "shared/features/base";
import { nameKeys, ref, text } from "shared/features/i18n";
import { ProfileData } from "shared/features/profile";
import { RateLimiter } from "shared/lib/rate-limiter";
import { setBoostPortionBonusProvider } from "server/features/boosters";
import { setLineBonusProvider } from "server/features/line";
import { setBaseOreBonusProvider } from "server/features/mining";
import { getLoadedPlayers, getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
import { trackQuest } from "server/features/quests";
import { setBaseSellProvider } from "server/features/selling";
import { notify } from "server/lib/notify";
import { logAbuse, onClientRequest } from "server/lib/remotes";

const TICK_SECONDS = 1;

function effectsOf(player: Player): BaseEffects | undefined {
	const data = getProfileData(player);
	return data === undefined ? undefined : baseEffects(data.base);
}

/** Finishes due builds, tells the owner and redraws. Safe to call any time. */
function settle(player: Player, data: ProfileData): void {
	for (const id of completeJobs(data.base, os.time())) {
		markDirty(player);
		notify(
			player,
			text("base.done", { name: ref(nameKeys.building(id)), level: levelOf(data.base, id) }),
			"success",
		);
	}
}

function handleStart(player: Player, args: Array<unknown>): void {
	const [id] = args;
	if (args.size() !== 1 || !isBuildingId(id)) {
		logAbuse(player, "bad StartBuild arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	settle(player, data);
	const result = tryStartBuild(data.base, id, data.money, os.time());
	if (!result.ok) {
		if (result.reason === "not-enough-money") {
			notify(player, text("common.notEnoughMoney"), "error");
		} else if (result.reason === "no-builder") {
			notify(player, text("base.noBuilder"), "error");
		} else if (result.reason === "office") {
			notify(player, text("base.needOffice", { level: result.office ?? 1 }), "error");
		}
		return;
	}
	// Money and the job change together, with no yield in between.
	data.money = result.money;
	applyStart(data.base, id, result.finishAt);
	markDirty(player);
	trackQuest(player, "upgradeMachine", 1);
	notify(player, text("base.started", { name: ref(nameKeys.building(id)) }), "success");
}

function handleSkip(player: Player, args: Array<unknown>): void {
	const [id] = args;
	if (args.size() !== 1 || !isBuildingId(id)) {
		logAbuse(player, "bad SkipBuild arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	const now = os.time();
	const result = trySkip(data.base, id, data.crystals, now);
	if (!result.ok) {
		if (result.reason === "not-enough-crystals") {
			notify(player, text("boost.notEnoughCrystals"), "error");
		}
		return;
	}
	data.crystals = result.crystals;
	applySkip(data.base, id, now);
	markDirty(player);
	settle(player, data);
}

function handleHire(player: Player, args: Array<unknown>): void {
	if (args.size() !== 0) {
		logAbuse(player, "bad HireBuilder arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	const result = tryHireBuilder(data.base, data.crystals);
	if (!result.ok) {
		if (result.reason === "not-enough-crystals") {
			notify(player, text("boost.notEnoughCrystals"), "error");
		}
		return;
	}
	data.crystals = result.crystals;
	data.base.builders += 1;
	markDirty(player);
	notify(player, text("base.builderHired"), "success");
}

export function startBaseService(): void {
	onClientRequest(START_BUILD_REMOTE, new RateLimiter(4, 2), handleStart);
	onClientRequest(SKIP_BUILD_REMOTE, new RateLimiter(4, 2), handleSkip);
	onClientRequest(HIRE_BUILDER_REMOTE, new RateLimiter(2, 0.5), handleHire);

	setBaseSellProvider((player) => effectsOf(player)?.sellBonus ?? 0);
	setBaseOreBonusProvider((player) => effectsOf(player)?.oreBonus ?? 0);
	setBoostPortionBonusProvider((player) => effectsOf(player)?.boostSeconds ?? 0);
	setLineBonusProvider((player) => {
		const effects = effectsOf(player);
		return effects === undefined ? undefined : { speed: effects.lineSpeed };
	});

	// Registered after the line's listener: builds finished while away count from now on, not for the offline run.
	onProfileLoaded((player) => {
		const data = getProfileData(player);
		if (data !== undefined) {
			settle(player, data);
		}
	});

	task.spawn(() => {
		for (;;) {
			task.wait(TICK_SECONDS);
			for (const player of getLoadedPlayers()) {
				const [ok, err] = pcall(() => {
					const data = getProfileData(player);
					if (data !== undefined && data.base.jobs.size() > 0) {
						settle(player, data);
					}
				});
				if (!ok) {
					warn(`[base] tick failed for ${player.UserId}: ${err}`);
				}
			}
		}
	});
}
