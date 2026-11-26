// Saves the sound switch from the game menu (decision 053). The client mutes itself; the server only stores the
// choice, so it follows the player to every server.
import { SET_SOUND_REMOTE } from "shared/features/settings";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty } from "server/features/profile";
import { logAbuse, onClientRequest } from "server/lib/remotes";

function handleSetSound(player: Player, args: Array<unknown>): void {
	const [on] = args;
	if (args.size() !== 1 || !typeIs(on, "boolean")) {
		logAbuse(player, "SetSound: bad arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined || data.soundOn === on) {
		return;
	}
	data.soundOn = on;
	markDirty(player);
}

export function startSettingsService(): void {
	onClientRequest(SET_SOUND_REMOTE, new RateLimiter(4, 2), handleSetSound);
}
