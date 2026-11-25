// Looks up a text in the player's language, falling back to English. Pure, so it runs under Lune.
import { STRINGS, StringKey } from "shared/config/i18n";
import { Language, SOURCE_LANGUAGE, TextParams, fillTemplate, isLanguage } from "./language";

export function isStringKey(value: unknown): value is StringKey {
	return typeIs(value, "string") && STRINGS.en[value as StringKey] !== undefined;
}

/** The text of `key` in `language` with its placeholders filled. Unknown language -> English. */
export function translate(language: Language, key: StringKey, params?: TextParams): string {
	const texts = isLanguage(language) ? STRINGS[language] : STRINGS[SOURCE_LANGUAGE];
	const template = texts[key] ?? STRINGS[SOURCE_LANGUAGE][key] ?? key;
	return fillTemplate(template, params);
}
