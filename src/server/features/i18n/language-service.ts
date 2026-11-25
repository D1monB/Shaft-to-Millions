// Saves the language a player picks in the game menu (decision 033). The client shows texts itself; the server only
// stores the choice, so it follows the player to every server. Nothing of value depends on it.
import { AUTO_LANGUAGE, SET_LANGUAGE_REMOTE, isLanguage } from "shared/features/i18n";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty } from "server/features/profile";
import { logAbuse, onClientRequest } from "server/lib/remotes";

function handleSetLanguage(player: Player, args: Array<unknown>): void {
	const [language] = args;
	if (args.size() !== 1 || (language !== AUTO_LANGUAGE && !isLanguage(language))) {
		logAbuse(player, "SetLanguage: bad arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined || data.language === language) {
		return;
	}
	data.language = language;
	markDirty(player);
}

export function startLanguageService(): void {
	onClientRequest(SET_LANGUAGE_REMOTE, new RateLimiter(4, 2), handleSetLanguage);
}
