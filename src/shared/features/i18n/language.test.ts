import { Assert, Test } from "@rbxts/lunit";
import { fillTemplate, localeLanguage, pickLanguage } from "./language";

class LanguageTests {
	@Test
	public savedChoiceWinsOverEverything() {
		Assert.deepEqual(pickLanguage("pl", "uk-ua", "UA"), { language: "pl", robloxTranslates: false });
		Assert.deepEqual(pickLanguage("en", "ru-ru", "RU"), { language: "en", robloxTranslates: false });
	}

	@Test
	public robloxLanguageComesNext() {
		Assert.deepEqual(pickLanguage(undefined, "uk-ua", "US"), { language: "uk", robloxTranslates: false });
		Assert.deepEqual(pickLanguage(undefined, "ru-ru", undefined), { language: "ru", robloxTranslates: false });
		Assert.deepEqual(pickLanguage(undefined, "pl_PL", "DE"), { language: "pl", robloxTranslates: false });
	}

	@Test
	public otherRobloxLanguagesGetEnglishThatRobloxTranslates() {
		Assert.deepEqual(pickLanguage(undefined, "es-es", "UA"), { language: "en", robloxTranslates: true });
		Assert.deepEqual(pickLanguage(undefined, "de-de", undefined), { language: "en", robloxTranslates: true });
	}

	@Test
	public englishRobloxFallsBackToTheCountry() {
		Assert.deepEqual(pickLanguage(undefined, "en-us", "UA"), { language: "uk", robloxTranslates: false });
		Assert.deepEqual(pickLanguage(undefined, "en-us", "by"), { language: "ru", robloxTranslates: false });
		Assert.deepEqual(pickLanguage(undefined, "en-us", "PL"), { language: "pl", robloxTranslates: false });
		Assert.deepEqual(pickLanguage(undefined, "en-us", "US"), { language: "en", robloxTranslates: false });
		Assert.deepEqual(pickLanguage(undefined, "en-us", undefined), { language: "en", robloxTranslates: false });
	}

	@Test
	public badInputFallsBackToEnglish() {
		const english = { language: "en", robloxTranslates: false };
		Assert.deepEqual(pickLanguage("klingon", undefined, undefined), english);
		Assert.deepEqual(pickLanguage(5, 7, 9), english);
		Assert.deepEqual(pickLanguage(0 / 0, "", ""), english);
		Assert.deepEqual(pickLanguage({}, "!!", "ZZ"), english);
		Assert.deepEqual(pickLanguage("UK", "en", "toString"), english);
		Assert.equal(localeLanguage(undefined), undefined);
		Assert.equal(localeLanguage("1-2"), undefined);
		Assert.equal(localeLanguage("PT-br"), "pt");
	}

	@Test
	public fillsPlaceholders() {
		Assert.equal(fillTemplate("Sold for {money}", { money: "$5" }), "Sold for $5");
		Assert.equal(fillTemplate("{a} and {b}", { a: 1, b: 2 }), "1 and 2");
		Assert.equal(fillTemplate("No params"), "No params");
		// A missing value stays visible instead of silently disappearing.
		Assert.equal(fillTemplate("Need {money}", {}), "Need {money}");
		// Values are inserted as plain text, even with pattern characters in them.
		Assert.equal(fillTemplate("{x}", { x: "100%" }), "100%");
	}
}

export = LanguageTests;
