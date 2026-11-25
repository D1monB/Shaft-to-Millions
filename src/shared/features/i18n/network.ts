// Remote names of the i18n feature.

/** Client -> server: (language: Language | "") saves the menu choice; "" = automatic. */
export const SET_LANGUAGE_REMOTE = "SetLanguage";

/** The value that means "pick automatically" in the profile and in SetLanguage. */
export const AUTO_LANGUAGE = "";

/**
 * World texts (ProximityPrompts, sign labels) are built by the server once for everyone, so they carry their text as
 * attributes and this tag; each client rewrites them locally in its own language. Attribute value: JSON {k, p}.
 */
export const LOCALIZED_TAG = "Localized";

export const I18N_ATTRIBUTES = {
	/** On a TextLabel / TextButton: its Text. */
	Text: "I18nText",
	/** On a ProximityPrompt: its ActionText and ObjectText. */
	Action: "I18nAction",
	Object: "I18nObject",
} as const;
