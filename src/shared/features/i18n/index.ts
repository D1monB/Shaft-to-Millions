// i18n feature (shared): which language a player sees and the texts in it (decision 033).
// Public API of this feature. Other code imports only from this file.
export {
	LANGUAGES,
	LANGUAGE_NAMES,
	SOURCE_LANGUAGE,
	fillTemplate,
	isLanguage,
	localeLanguage,
	pickLanguage,
} from "./language";
export type { Language, LanguageChoice, TextParams } from "./language";
export { isStringKey, translate } from "./translate";
export { AUTO_LANGUAGE, SET_LANGUAGE_REMOTE } from "./network";
export { decodeText, ref, text, translateText } from "./text";
export type { Text } from "./text";
export { nameKeys } from "./names";
export { LOCALIZED_TAG, I18N_ATTRIBUTES } from "./network";
