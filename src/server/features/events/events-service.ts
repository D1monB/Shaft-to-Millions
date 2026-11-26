// Layer events on the server (decision 065): cave-ins, the shared crystal cluster and the timed raid with its
// weekly top. Scores and rewards come only from what the server itself saw mined.
import { Players } from "@rbxts/services";
import { CLUSTER_HITS, RAID_TOP_SYNC_SECONDS } from "shared/config/events";
import { ORES, OreId } from "shared/config/ores";
import {
	ClusterState,
	RAID_ENDS_ATTRIBUTE,
	RAID_SCORE_ATTRIBUTE,
	RAID_TOP_REMOTE,
	RaidRow,
	RaidRun,
	START_RAID_REMOTE,
	addRaidOre,
	clusterCrystals,
	clusterHit,
	finishRaid,
	newCluster,
	raidCooldownLeft,
	startRaid,
	weekOf,
} from "shared/features/events";
import { text } from "shared/features/i18n";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { MAX_COUNTER } from "shared/lib/repair";
import { setClusterHandler, onOreMined } from "server/features/mining";
import { setSpeedPenaltyProvider } from "server/features/movement";
import { getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
import { notify } from "server/lib/notify";
import { declareClientEvent, fireClient, logAbuse, onClientRequest, remoteEvent } from "server/lib/remotes";
import { forgetSlow, speedPenalty, startCaveIns } from "./cave-ins";
import { raiseRaidScore, readRaidTop } from "./raid-top";

const runs = new Map<Player, RaidRun>();
const clusters = new Map<Instance, ClusterState>();
let topRows: RaidRow[] = [];

// ---- crystal cluster ----

/** One swing at a cluster block. The mining service already checked distance, layer and pickaxe. */
function hitCluster(
	player: Player,
	node: Instance,
	swingSeconds: number,
): { left: number; needed: number } | undefined {
	let state = clusters.get(node);
	if (state === undefined) {
		state = newCluster(CLUSTER_HITS);
		clusters.set(node, state);
	}
	const result = clusterHit(state, player.UserId, os.clock(), swingSeconds);
	if (result === "cooldown" || result === "gone") {
		return undefined;
	}
	if (result === "broken") {
		clusters.delete(node);
		node.Destroy();
		// Everyone who helped is paid in this same frame.
		for (const other of Players.GetPlayers()) {
			const data = getProfileData(other);
			const crystals = clusterCrystals(state, other.UserId);
			if (data !== undefined && crystals > 0) {
				data.crystals = math.min(data.crystals + crystals, MAX_COUNTER);
				markDirty(other);
				notify(other, text("events.clusterReward", { count: crystals }), "success");
			}
		}
	}
	return { left: state.left, needed: state.needed };
}

// ---- raid ----

function publishRun(player: Player, run: RaidRun | undefined): void {
	player.SetAttribute(RAID_ENDS_ATTRIBUTE, run?.endsAt);
	player.SetAttribute(RAID_SCORE_ATTRIBUTE, run?.score);
}

function handleStartRaid(player: Player, args: Array<unknown>): void {
	if (args.size() !== 0) {
		logAbuse(player, "bad StartRaid arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined || runs.has(player)) {
		return;
	}
	const run = startRaid(data.raid, os.time());
	if (run === undefined) {
		const wait = math.ceil(raidCooldownLeft(data.raid, os.time()) / 60);
		notify(player, text("events.raidWait", { minutes: wait }), "info");
		return;
	}
	runs.set(player, run);
	markDirty(player);
	publishRun(player, run);
	notify(player, text("events.raidStarted"), "success");
}

function endRaid(player: Player, run: RaidRun): void {
	runs.delete(player);
	publishRun(player, undefined);
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	const now = os.time();
	const result = finishRaid(data.raid, run, now);
	data.crystals = math.min(data.crystals + result.crystals, MAX_COUNTER);
	markDirty(player);
	notify(
		player,
		text(result.newBest ? "events.raidBest" : "events.raidDone", {
			score: formatMoney(result.score),
			crystals: result.crystals,
		}),
		"success",
	);
	if (result.score > 0) {
		task.spawn(() => {
			const [ok, err] = pcall(raiseRaidScore, weekOf(now), player.UserId, data.raid.best);
			if (!ok) {
				warn(`[events] raid score write failed: ${err}`);
			}
		});
	}
}

function syncTop(): void {
	const week = weekOf(os.time());
	const [ok, rows] = pcall(readRaidTop, week);
	if (ok) {
		topRows = rows as RaidRow[];
		remoteEvent(RAID_TOP_REMOTE).FireAllClients(topRows);
	}
}

export function startEventsService(): void {
	declareClientEvent(RAID_TOP_REMOTE);
	onClientRequest(START_RAID_REMOTE, new RateLimiter(2, 0.5), handleStartRaid);
	setClusterHandler(hitCluster);
	onOreMined((player: Player, oreId: OreId, pieces: number) => {
		const run = runs.get(player);
		if (run !== undefined) {
			addRaidOre(run, ORES[oreId].price, pieces, os.time());
			publishRun(player, run);
		}
	});
	setSpeedPenaltyProvider(speedPenalty);
	onProfileLoaded((player) => fireClient(RAID_TOP_REMOTE, player, topRows));
	Players.PlayerRemoving.Connect((player) => {
		// A raid left halfway is not scored: the cooldown already started, so rejoining gains nothing.
		runs.delete(player);
		forgetSlow(player);
	});
	startCaveIns();
	task.spawn(() => {
		for (;;) {
			task.wait(1);
			const now = os.time();
			for (const [player, run] of runs) {
				if (now >= run.endsAt) {
					const [ok, err] = pcall(endRaid, player, run);
					if (!ok) {
						runs.delete(player);
						warn(`[events] raid end failed for ${player.UserId}: ${err}`);
					}
				}
			}
		}
	});
	task.spawn(() => {
		for (;;) {
			syncTop();
			task.wait(RAID_TOP_SYNC_SECONDS);
		}
	});
}
