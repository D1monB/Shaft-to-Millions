// Leaderboards (deepest and richest). The server records the player's depth from honest movement samples,
// writes grown scores to the board store once a minute and sends the top rows to every client.
// The client sends nothing: there is no remote a cheater could call to change a score.
import { CollectionService, Players, RunService } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import {
	LEADERBOARD_REMOTE,
	LeaderboardSnapshot,
	SYNC_INTERVAL,
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

const FALLBACK_NAME = "Гравець";

const written = new WrittenScores();
const names = new NameCache((userId) => {
	// A player on this server needs no web call.
	const here = Players.GetPlayerByUserId(userId);
	// The typings take a branded `User` id; at runtime it is the plain number.
	return here !== undefined ? here.Name : Players.GetNameFromUserIdAsync(userId as unknown as User);
}, FALLBACK_NAME);
let snapshot: LeaderboardSnapshot = emptySnapshot();

// Logged at most once per round, so an outage cannot flood the output.
let failureLogged = false;

/** Height of the surface: depth is measured from the SurfaceSpawn. Undefined until the map has one. */
function surfaceY(): number | undefined {
	const spawn = CollectionService.GetTagged(TAGS.SurfaceSpawn)[0];
	return spawn === undefined ? undefined : getInstancePosition(spawn)?.Y;
}

/**
 * Deepest meters the player may have reached: the camp of the first layer they have NOT opened.
 * Walking or falling past a locked camp never becomes a record. No such camp (last layer open) = no cap.
 */
function depthCap(surface: number, deepestLayer: number): number {
	for (const camp of CollectionService.GetTagged(TAGS.CampSpawn)) {
		if (camp.GetAttribute(ATTRIBUTES.LayerId) === deepestLayer + 1) {
			const position = getInstancePosition(camp);
			if (position !== undefined) {
				return depthMeters(surface, position.Y);
			}
		}
	}
	return math.huge;
}

function onSample(player: Player, position: Vector3): void {
	// Only standing on something counts. Mid-air (jumping, falling into the void) is never a record.
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	const data = getProfileData(player);
	const surface = surfaceY();
	if (humanoid === undefined || humanoid.FloorMaterial === Enum.Material.Air || data === undefined) {
		return;
	}
	if (surface === undefined) {
		return;
	}
	const record = recordDepth(
		data.deepestMeters,
		depthMeters(surface, position.Y),
		depthCap(surface, data.deepestLayer),
	);
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
}

export function startLeaderboardService(): void {
	declareClientEvent(LEADERBOARD_REMOTE);
	const activeStore = RunService.IsStudio() ? createMemoryStore() : createOrderedStore();

	onHonestSample((player, position) => {
		// pcall: a broken character must not stop the movement check of everyone else.
		pcall(onSample, player, position);
	});

	// A new player sees the current boards right away instead of waiting for the next round.
	onProfileLoaded((player) => remoteEvent(LEADERBOARD_REMOTE).FireClient(player, snapshot));

	onProfileReleasing((player) => {
		// Read the scores now, while the data is still there; the write itself yields, so it runs in its own thread.
		const scores = scoresOf(player);
		const userId = player.UserId;
		task.spawn(() => {
			if (scores !== undefined) {
				writeScores(activeStore, written, userId, scores);
			}
			written.forget(userId);
		});
	});

	task.spawn(() => {
		// First read at once, so the boards are not empty for a whole minute after a server starts.
		pcall(syncRound, activeStore);
		for (;;) {
			task.wait(SYNC_INTERVAL);
			pcall(syncRound, activeStore);
		}
	});
}
