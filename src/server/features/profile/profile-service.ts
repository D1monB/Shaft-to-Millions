import { Players } from "@rbxts/services";
import { ProfileData, toPlayerView } from "shared/features/profile";
import { NOTIFY_REMOTE, STATE_UPDATE_REMOTE } from "shared/lib/remote-names";
import { declareClientEvent, fireClient } from "server/lib/remotes";
import { ProfileSessions } from "./profile-sessions";
import { createRobloxBackend } from "./roblox-backend";

let sessions: ProfileSessions | undefined;

function kickPlayer(userId: number, message: string): void {
	Players.GetPlayerByUserId(userId)?.Kick(message);
}

const loadedListeners: Array<(player: Player) => void> = [];

/** Runs `callback` each time a player's data finishes loading. Register before startProfileService(). */
export function onProfileLoaded(callback: (player: Player) => void): void {
	loadedListeners.push(callback);
}

const releasingListeners: Array<(player: Player) => void> = [];

/**
 * Runs `callback` when a player leaves, while their data is still readable (just before it is released).
 * Why: the order of separate PlayerRemoving handlers is not guaranteed, so a feature reading data there
 * could find it already gone. The callback must not yield.
 */
export function onProfileReleasing(callback: (player: Player) => void): void {
	releasingListeners.push(callback);
}

// Players whose view must be re-sent. Many changes in one frame produce one network message.
const dirty = new Set<Player>();

/** Call after changing a player's data: the client gets a fresh view at the end of this frame. */
export function markDirty(player: Player): void {
	if (dirty.has(player)) {
		return;
	}
	dirty.add(player);
	task.defer(() => {
		dirty.delete(player);
		const data = getProfileData(player);
		if (data !== undefined && player.Parent !== undefined) {
			fireClient(STATE_UPDATE_REMOTE, player, toPlayerView(data));
		}
	});
}

/** Starts loading data for every player who joins. Call once, before any other feature reads player data. */
export function startProfileService(): void {
	if (sessions !== undefined) {
		return;
	}
	// Both are fired only by the server (state updates and notify() from every service).
	declareClientEvent(STATE_UPDATE_REMOTE);
	declareClientEvent(NOTIFY_REMOTE);
	const created = new ProfileSessions(createRobloxBackend(), kickPlayer, (message) => warn(`[profile] ${message}`));
	sessions = created;

	created.onLoaded((userId) => {
		const player = Players.GetPlayerByUserId(userId);
		if (player === undefined) {
			return;
		}
		for (const listener of loadedListeners) {
			listener(player);
		}
		markDirty(player);
	});

	Players.PlayerAdded.Connect((player) => created.playerAdded(player.UserId));
	Players.PlayerRemoving.Connect((player) => {
		dirty.delete(player);
		if (getProfileData(player) !== undefined) {
			for (const listener of releasingListeners) {
				// pcall: one feature's bug must never stop the profile from being released and saved.
				pcall(listener, player);
			}
		}
		created.playerRemoving(player.UserId);
	});

	// Players who joined before this script ran (happens in Studio).
	for (const player of Players.GetPlayers()) {
		task.spawn(() => created.playerAdded(player.UserId));
	}
}

/**
 * The player's live data, or undefined if it is not loaded (yet). Server only.
 * Call it fresh for every operation and never keep the result: after the player leaves or the session is
 * lost, a kept table can still be changed but is no longer saved, which makes side effects a duplication risk.
 */
export function getProfileData(player: Player): ProfileData | undefined {
	return sessions?.getData(player.UserId);
}

/**
 * Saves the player's profile now and yields until it is confirmed (or the timeout passes).
 * Call it after granting a Robux purchase and before returning PurchaseGranted.
 */
export function saveProfileNow(player: Player, timeoutSeconds: number): boolean {
	return sessions?.saveNow(player.UserId, timeoutSeconds) ?? false;
}

/** All players whose data is loaded right now. Used by periodic ticks (machines, drills). */
export function getLoadedPlayers(): Player[] {
	return Players.GetPlayers().filter((player) => getProfileData(player) !== undefined);
}
