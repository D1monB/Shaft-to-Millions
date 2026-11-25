// All game texts by language (decision 033). English is the source; the others translate every key.
import { EN, Strings } from "./en";
import { PL } from "./pl";
import { RU } from "./ru";
import { UK } from "./uk";

export type { StringKey, Strings } from "./en";

export const STRINGS: { readonly en: Strings; readonly uk: Strings; readonly ru: Strings; readonly pl: Strings } = {
	en: EN,
	uk: UK,
	ru: RU,
	pl: PL,
};
