// Base building on the server (decision 063): starting builds, timers (also while offline, by unix time), skipping
// with crystals, builders, the buildings on each owner's plot, and the bonuses other features ask for.
import { Players, Workspace } from "@rbxts/services";
import { BUILDING_IDS, isBuildingId } from "shared/config/base";
import { PLOT_ATTRIBUTES } from "shared/config/map-contract";
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
	jobOf,
	secondsLeft,
	tryHireBuilder,
	trySkip,
	tryStartBuild,
} from "shared/features/base";
import { nameKeys, ref, text } from "shared/features/i18n";
import { ProfileData } from "shared/features/profile";
import { RateLimiter } from "shared/lib/rate-limiter";
import { setBoostPortionBonusProvider } from "server/features/boosters";
import { onPlotBuilt, onPlotReleased, setLineBonusProvider } from "server/features/line";
import { setBaseOreBonusProvider } from "server/features/mining";
import { getLoadedPlayers, getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
import { trackQuest } from "server/features/quests";
import { setBaseSellProvider } from "server/features/selling";
import { notify } from "server/lib/notify";
import { logAbuse, onClientRequest } from "server/lib/remotes";
import { PlotArea, Site, createSite, drawSite, findSpots } from "./site-visuals";

const TICK_SECONDS = 1;
const sitesOf = new Map<Player, { folder: Folder; sites: Site[] }>();

function effectsOf(player: Player): BaseEffects | undefined {
	const data = getProfileData(player);
	return data === undefined ? undefined : baseEffects(data.base);
}

function redraw(player: Player, data: ProfileData): void {
	const owned = sitesOf.get(player);
	if (owned === undefined) {
		return;
	}
	const now = os.time();
	for (const site of owned.sites) {
		const left = jobOf(data.base, site.id) !== undefined ? secondsLeft(data.base, site.id, now) : undefined;
		drawSite(site, levelOf(data.base, site.id), left);
	}
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
	redraw(player, data);
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
	redraw(player, data);
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

function removeSites(player: Player): void {
	sitesOf.get(player)?.folder.Destroy();
	sitesOf.delete(player);
}

function buildSites(player: Player, model: Model, area: PlotArea): void {
	removeSites(player);
	const folder = new Instance("Folder");
	folder.Name = `Base_${tostring(model.GetAttribute(PLOT_ATTRIBUTES.PlotIndex) ?? player.UserId)}`;
	folder.Parent = Workspace;
	const spots = findSpots(area);
	const sites = BUILDING_IDS.map((id, index) => createSite(folder, id, spots[index]));
	sitesOf.set(player, { folder, sites });
	const data = getProfileData(player);
	if (data !== undefined) {
		redraw(player, data);
	}
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
		return effects === undefined ? undefined : { speed: effects.lineSpeed, offlineSeconds: effects.offlineSeconds };
	});

	// Registered before the line feature starts, so builds finished while away count for the offline line run.
	onProfileLoaded((player) => {
		const data = getProfileData(player);
		if (data !== undefined) {
			settle(player, data);
		}
	});
	onPlotBuilt((player, model, area) => buildSites(player, model, area));
	onPlotReleased(removeSites);
	Players.PlayerRemoving.Connect(removeSites);

	task.spawn(() => {
		for (;;) {
			task.wait(TICK_SECONDS);
			for (const player of getLoadedPlayers()) {
				const [ok, err] = pcall(() => {
					const data = getProfileData(player);
					if (data !== undefined && data.base.jobs.size() > 0) {
						settle(player, data);
						redraw(player, data);
					}
				});
				if (!ok) {
					warn(`[base] tick failed for ${player.UserId}: ${err}`);
				}
			}
		}
	});
}
