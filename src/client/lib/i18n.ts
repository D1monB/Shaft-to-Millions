// The language this client shows (decision 033) and the helpers every UI file uses to get its words.
// The i18n feature decides the language (menu choice, Roblox language, country) and sets it here; the UI root
// re-mounts on a change, so plain `t()` calls during render are always current.
import { StringKey } from "shared/config/i18n";
import {
	Language,
	LanguageChoice,
	SOURCE_LANGUAGE,
	Text,
	TextParams,
	translate,
	translateText,
} from "shared/features/i18n";
import { Store, useStore } from "./store";

const choiceStore = new Store<LanguageChoice>({ language: SOURCE_LANGUAGE, robloxTranslates: false });

export function setLanguageChoice(choice: LanguageChoice): void {
	const current = choiceStore.get();
	if (current.language !== choice.language || current.robloxTranslates !== choice.robloxTranslates) {
		choiceStore.set(choice);
	}
}

export function getLanguageChoice(): LanguageChoice {
	return choiceStore.get();
}

export function getLanguage(): Language {
	return choiceStore.get().language;
}

/** Calls `listener` on every language change (not right away). Returns a function that stops listening. */
export function onLanguageChanged(listener: (choice: LanguageChoice) => void): () => void {
	return choiceStore.subscribe(listener);
}

/** React hook: the current choice, re-rendering when it changes. */
export function useLanguageChoice(): LanguageChoice {
	return useStore(choiceStore);
}

/** The text of `key` in the player's language. */
export function t(key: StringKey, params?: TextParams): string {
	return translate(getLanguage(), key, params);
}

/** A text built elsewhere (by the server or pure logic) in the player's language. */
export function tx(value: Text): string {
	return translateText(getLanguage(), value);
}
