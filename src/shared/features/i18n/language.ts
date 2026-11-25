// Which language a player sees (decision 033). Pure logic on plain strings, so it runs under Lune.
// Order: the player's own choice in the game menu, then the language of their Roblox settings, then (when Roblox is
// set to English) the country they play from, then English. Languages we do not have are shown in English, and
// Roblox's automatic translation may translate that English text (`robloxTranslates`).

export type Language = "en" | "uk" | "ru" | "pl";

/** Languages with our own texts, in the order the menu lists them. English is the source language. */
export const LANGUAGES: ReadonlyArray<Language> = ["en", "uk", "ru", "pl"];

export const SOURCE_LANGUAGE: Language = "en";

/** Each language's own name, for the menu (always written in that language). */
export const LANGUAGE_NAMES: { readonly [K in Language]: string } = {
	en: "English",
	uk: "Українська",
	ru: "Русский",
	pl: "Polski",
};

/** Country (ISO 3166 alpha-2, as Roblox reports it) -> language, only for countries with one of our languages. */
const COUNTRY_LANGUAGES: { readonly [country: string]: Language } = {
	UA: "uk",
	PL: "pl",
	RU: "ru",
	BY: "ru",
	KZ: "ru",
	KG: "ru",
};

export function isLanguage(value: unknown): value is Language {
	return typeIs(value, "string") && (LANGUAGES as ReadonlyArray<string>).includes(value);
}

/** "uk-ua" / "pl_PL" / "EN" -> "uk" / "pl" / "en"; anything that is not a locale -> undefined. */
export function localeLanguage(locale: unknown): string | undefined {
	if (!typeIs(locale, "string")) {
		return undefined;
	}
	const [code] = locale.lower().match("^(%a%a%a?)[-_]?");
	return typeIs(code, "string") ? code : undefined;
}

export interface LanguageChoice {
	readonly language: Language;
	/** True: the player's Roblox language is not one of ours, so Roblox may auto-translate our English text. */
	readonly robloxTranslates: boolean;
}

/**
 * Picks the language to show.
 * @param saved the choice stored in the player's profile (undefined = automatic)
 * @param robloxLocale the player's Roblox language, e.g. "uk-ua" (Player.LocaleId)
 * @param country the country code Roblox reports for the player, if known (never stored)
 */
export function pickLanguage(saved: unknown, robloxLocale: unknown, country: unknown): LanguageChoice {
	if (isLanguage(saved)) {
		return { language: saved, robloxTranslates: false };
	}
	const fromRoblox = localeLanguage(robloxLocale);
	if (fromRoblox !== undefined && fromRoblox !== SOURCE_LANGUAGE) {
		return isLanguage(fromRoblox)
			? { language: fromRoblox, robloxTranslates: false }
			: { language: SOURCE_LANGUAGE, robloxTranslates: true };
	}
	// Roblox is in English (the default for many players) or unknown: the country may tell us better.
	const fromCountry = typeIs(country, "string") ? COUNTRY_LANGUAGES[country.upper()] : undefined;
	return { language: fromCountry ?? SOURCE_LANGUAGE, robloxTranslates: false };
}

export type TextParams = { readonly [name: string]: string | number };

/** Fills "{name}" placeholders from `params`. A missing param stays visible as "{name}" so the bug shows in tests. */
export function fillTemplate(template: string, params?: TextParams): string {
	if (params === undefined) {
		return template;
	}
	const [result] = template.gsub("{(%w+)}", (name: string) => {
		const value = params[name];
		return value !== undefined ? tostring(value) : `{${name}}`;
	});
	return result;
}
