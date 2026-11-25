// A text that is not yet in any language: a key and its values. The server and pure logic build these; only the
// client turns them into words, in the player's language (decision 033). Pure, so it runs under Lune.
import { StringKey } from "shared/config/i18n";
import { Language, TextParams } from "./language";
import { isStringKey, translate } from "./translate";

export interface Text {
	readonly key: StringKey;
	readonly params?: TextParams;
}

export function text(key: StringKey, params?: TextParams): Text {
	return { key, params };
}

/**
 * A param value that is itself a text: "@ore.copper" is shown as the copper name in the player's language.
 * Names of ores, machines and gear travel this way, so the server never needs to know the language.
 */
export function ref(key: StringKey): string {
	return `@${key}`;
}

/** Most values a text may carry; more is junk from a broken or hostile sender. */
const MAX_PARAMS = 8;
/** Longest string value accepted from the network (names and formatted numbers are short). */
const MAX_PARAM_LENGTH = 80;

/** The words of `value` in `language`; "@key" params are translated too (one level, never recursive). */
export function translateText(language: Language, value: Text): string {
	if (value.params === undefined) {
		return translate(language, value.key);
	}
	const params: { [name: string]: string | number } = {};
	for (const [name, param] of pairs(value.params)) {
		const refKey = typeIs(param, "string") && param.sub(1, 1) === "@" ? param.sub(2) : undefined;
		params[name as string] = refKey !== undefined && isStringKey(refKey) ? translate(language, refKey) : param;
	}
	return translate(language, value.key, params);
}

function isFiniteNumber(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

/**
 * Checks a text that came over the network or from an attribute: a known key and at most a few short string or
 * finite number values. Anything else -> undefined (the message is dropped, never shown half-broken).
 */
export function decodeText(key: unknown, params: unknown): Text | undefined {
	if (!isStringKey(key)) {
		return undefined;
	}
	if (params === undefined) {
		return { key };
	}
	if (!typeIs(params, "table")) {
		return undefined;
	}
	const checked: { [name: string]: string | number } = {};
	let count = 0;
	for (const [name, value] of pairs(params as object)) {
		count += 1;
		if (count > MAX_PARAMS || !typeIs(name, "string")) {
			return undefined;
		}
		if (isFiniteNumber(value) || (typeIs(value, "string") && value.size() <= MAX_PARAM_LENGTH)) {
			checked[name] = value;
		} else {
			return undefined;
		}
	}
	return { key, params: checked };
}
