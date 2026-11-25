// Decides which language this client shows (decision 033): the menu choice saved in the profile, then the player's
// Roblox language, then (when Roblox is in English) the country Roblox reports, then English. The country is asked
// once and kept only in memory: it is never sent to the server or saved.
import { LocalizationService, Players } from "@rbxts/services";
import { AUTO_LANGUAGE, Language, SET_LANGUAGE_REMOTE, pickLanguage } from "shared/features/i18n";
import { onViewChanged } from "client/features/profile";
import { setLanguageChoice } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";

let saved: string = AUTO_LANGUAGE;
let country: string | undefined;
/** The choice made in the menu this session, shown at once, before the server confirms it in the profile. */
let pending: string | undefined;

function refresh(): void {
	setLanguageChoice(pickLanguage(pending ?? saved, Players.LocalPlayer.LocaleId, country));
}

/** The saved menu choice: one of our languages, or "" for automatic. */
export function getSavedLanguage(): string {
	return pending ?? saved;
}

/** Saves a menu choice (a language, or AUTO_LANGUAGE) and shows it right away. */
export function chooseLanguage(language: Language | typeof AUTO_LANGUAGE): void {
	pending = language;
	refresh();
	sendToServer(SET_LANGUAGE_REMOTE, language);
}

export function startLanguageController(): void {
	refresh();
	onViewChanged((view) => {
		saved = view.language;
		if (pending === saved) {
			pending = undefined;
		}
		refresh();
	});
	Players.LocalPlayer.GetPropertyChangedSignal("LocaleId").Connect(refresh);
	task.spawn(() => {
		// A web call that may fail (Studio, outages): without a country the Roblox language decides alone.
		const [ok, result] = pcall(() => LocalizationService.GetCountryRegionForPlayerAsync(Players.LocalPlayer));
		if (ok && typeIs(result, "string")) {
			country = result;
			refresh();
		}
	});
}
