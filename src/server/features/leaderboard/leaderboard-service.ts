// Leaderboards (deepest and richest). The server records the player's depth from honest movement samples,
// writes grown scores to the board store once a minute and sends the top rows to every client.
// The client sends nothing: there is no remote a cheater could call to change a score.
import { CollectionService, Players, RunService } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import {
	LEADERBOARD_REMOTE,
	LeaderboardSnapshot,
	SYNC_INTERVAL,
	depthLimit,
	depthMeters,
	depthScore,
	recordDepth,
	wealthScore,
} from "shared/features/leaderboard";
import { onHonestSample } from "server/features/movement";
import { getLoadedPlayers, getProfileData, onProfileLoaded, onProfileReleasing } from "server/features/profile";
import { getInstancePosition } from "server/lib/proximity";
import { declareClientEvent, remoteEvent } from "server/lib/remotes";
import { NameCache, Scores, WrittenScores, emptySnapshot, readBoards, writeScores } from "./board-sync";
import { createMemoryStore, createOrderedStore } from "./stores";
import { LeaderboardStore } from "./ports";

const FALLBACK_NAME = "Player";

/** Extra studs below the feet the ground raycast reaches (slopes, stairs, a small hop). */
const GROUND_SLACK_STUDS = 3;

const written = new WrittenScores();
const names = new NameCache((userId) => {
	// A player on this server needs no web call.
	const here = Players.GetPlayerByUserId(userId);
	// The typings take a branded `User` id; at runtime it is the plain number.
	return here !== undefined ? here.Name : Players.GetNameFromUserIdAsync(userId as unknown as User);
}, FALLBACK_NAME);
let snapshot: LeaderboardSnapshot = emptySnapshot();

// Logged at most once per outage, so a DataStore problem cannot flood the output.
let failureLogged = false;
let errorLogged = false;

/** Logs the first error of a broken round, then stays quiet until a round works again. */
function runLogged<A extends unknown[]>(label: string, work: (...args: A) => void, ...args: A): void {
	const [ok, err] = pcall(work, ...args);
	if (!ok && !errorLogged) {
		warn(`[leaderboard] ${label} failed: ${err}`);
		errorLogged = true;
	}
}

/** Map heights, read once per sync round instead of on every movement sample. */
interface MapHeights {
	readonly surfaceY: number | undefined;
	/** Depth in meters of the camp of each layer that has one. */
	readonly campMeters: ReadonlyMap<number, number>;
}

let heights: MapHeights = { surfaceY: undefined, campMeters: new Map() };

function readMapHeights(): MapHeights {
	// The highest SurfaceSpawn, so several of them (placeholders and a real one) give a stable surface.
	let surface: number | undefined;
	for (const spawn of CollectionService.GetTagged(TAGS.SurfaceSpawn)) {
		const y = getInstancePosition(spawn)?.Y;
		if (y !== undefined && (surface === undefined || y > surface)) {
			surface = y;
		}
	}
	const campMeters = new Map<number, number>();
	if (surface !== undefined) {
		for (const camp of CollectionService.GetTagged(TAGS.CampSpawn)) {
			const layer = camp.GetAttribute(ATTRIBUTES.LayerId);
			const y = getInstancePosition(camp)?.Y;
			if (typeIs(layer, "number") && y !== undefined) {
				campMeters.set(layer, depthMeters(surface, y));
			}
		}
	}
	return { surfaceY: surface, campMeters };
}

/**
 * True when the character stands on real map geometry, checked by the server itself.
 * Why not Humanoid.FloorMaterial: the client simulates its own character, so that value is the client's word.
 * A server raycast only sees parts that exist on the server, and anchored ones cannot be moved by a client.
 */
function standsOnMap(character: Model, root: BasePart, humanoid: Humanoid): boolean {
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = [character];
	const reach = humanoid.HipHeight + root.Size.Y / 2 + GROUND_SLACK_STUDS;
	const hit = game.Workspace.Raycast(root.Position, new Vector3(0, -reach, 0), params);
	return hit !== undefined && hit.Instance.Anchored;
}

function onSample(player: Player, position: Vector3): void {
	const character = player.Character;
	const humanoid = character?.FindFirstChildOfClass("Humanoid");
	const root = character?.FindFirstChild("HumanoidRootPart");
	const data = getProfileData(player);
	const surface = heights.surfaceY;
	if (character === undefined || humanoid === undefined || root === undefined || !root.IsA("BasePart")) {
		return;
	}
	if (data === undefined || surface === undefined) {
		return;
	}
	const limit = depthLimit(data.deepestLayer, heights.campMeters.get(data.deepestLayer + 1));
	// Cheap checks first: the raycast only runs when the sample could be a new record at all.
	const sample = depthMeters(surface, position.Y);
	if (limit === undefined || sample <= data.deepestMeters || !standsOnMap(character, root, humanoid)) {
		return;
	}
	const record = recordDepth(data.deepestMeters, sample, limit);
	if (record !== undefined) {
		// Saved with the profile. No markDirty: the client does not show it live, and a descent would
		// otherwise send the whole profile several times a second.
		data.deepestMeters = record;
	}
}

function scoresOf(player: Player): Scores | undefined {
	const data = getProfileData(player);
	if (data === undefined) {
		return undefined;
	}
	return { depth: depthScore(data.deepestLayer, data.deepestMeters), wealth: wealthScore(data.stats.totalEarned) };
}

function writePlayer(activeStore: LeaderboardStore, player: Player): number {
	const scores = scoresOf(player);
	return scores === undefined ? 0 : writeScores(activeStore, written, player.UserId, scores);
}

function syncRound(activeStore: LeaderboardStore): void {
	heights = readMapHeights();
	let failed = 0;
	for (const player of getLoadedPlayers()) {
		failed += writePlayer(activeStore, player);
	}
	if (failed > 0 && !failureLogged) {
		warn(`[leaderboard] ${failed} score writes failed, retrying next round`);
		failureLogged = true;
	} else if (failed === 0) {
		failureLogged = false;
	}
	snapshot = readBoards(activeStore, names, snapshot);
	remoteEvent(LEADERBOARD_REMOTE).FireAllClients(snapshot);
	errorLogged = false;
}

export function startLeaderboardService(): void {
	declareClientEvent(LEADERBOARD_REMOTE);
	const activeStore = RunService.IsStudio() ? createMemoryStore() : createOrderedStore();

	onHonestSample((player, position) => {
		// pcall: a broken character must not stop the movement check of everyone else.
		runLogged("depth sample", onSample, player, position);
	});

	// A new player sees the current boards right away instead of waiting for the next round.
	onProfileLoaded((player) => remoteEvent(LEADERBOARD_REMOTE).FireClient(player, snapshot));

	onProfileReleasing((player) => {
		// Read the scores now, while the data is still there; the write itself yields, so it runs in its own thread.
		const scores = scoresOf(player);
		const userId = player.UserId;
		// The written scores are NOT forgotten: a rejoin on this server then writes only what grew,
		// so join/leave spam cannot burn the DataStore budget of everyone else.
		task.spawn(() => {
			if (scores !== undefined) {
				writeScores(activeStore, written, userId, scores);
			}
		});
	});

	task.spawn(() => {
		// First read at once, so the boards are not empty for a whole minute after a server starts.
		runLogged("sync round", syncRound, activeStore);
		for (;;) {
			task.wait(SYNC_INTERVAL);
			runLogged("sync round", syncRound, activeStore);
		}
	});

	// On shutdown, write once more for everyone still here. Best effort: Roblox gives BindToClose about 30 s
	// and the profile service saves in parallel; a lost write only costs the last minute of a board score.
	game.BindToClose(() => {
		for (const player of getLoadedPlayers()) {
			pcall(writePlayer, activeStore, player);
		}
	});
}
