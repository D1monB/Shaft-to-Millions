import { Assert, Test } from "@rbxts/lunit";
import { STRINGS, StringKey } from "shared/config/i18n";
import { LANGUAGES } from "./language";
import { isStringKey, translate } from "./translate";

class TranslateTests {
	@Test
	public everyLanguageHasEveryKeyAndNoExtras() {
		for (const language of LANGUAGES) {
			for (const [key, text] of pairs(STRINGS.en)) {
				const translated = STRINGS[language][key as StringKey];
				Assert.true(typeIs(translated, "string") && translated.size() > 0, `${language} lacks ${key}`);
				// Placeholders must match, or a translated text would lose a number.
				for (const [name] of (text as string).gmatch("{(%w+)}")) {
					Assert.true(
						translated.find(`{${name}}`, 1, true)[0] !== undefined,
						`${language} ${key}: {${name}}`,
					);
				}
			}
			for (const [key] of pairs(STRINGS[language])) {
				Assert.true(isStringKey(key), `${language} has unknown key ${key}`);
			}
		}
	}

	@Test
	public translatesAndFallsBack() {
		Assert.equal(translate("uk", "language.title"), "Мова");
		Assert.equal(translate("en", "language.title"), "Language");
		// A broken language value (should never happen) shows English instead of nothing.
		Assert.equal(translate("xx" as never, "language.title"), "Language");
	}

	@Test
	public keyCheckRejectsJunk() {
		Assert.true(isStringKey("language.title"));
		Assert.false(isStringKey("language.nope"));
		Assert.false(isStringKey(5));
		Assert.false(isStringKey(undefined));
	}
}

export = TranslateTests;
