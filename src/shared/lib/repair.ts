// Helpers that force saved values into valid ranges. Used by the profile sanitizer.
// Each helper records the path it had to change, so the server can log suspicious saves.
import { PlainTable } from "./tables";

/** Upper bound for counters and money: far above real values, low enough that math never overflows. */
export const MAX_COUNTER = 1_000_000_000_000;

export function repairInteger(
	target: PlainTable,
	key: string,
	min: number,
	max: number,
	fallback: number,
	path: string,
	repairs: string[],
): void {
	const value = target[key];
	let fixed: number;
	if (!typeIs(value, "number") || value !== value) {
		// Wrong type or NaN: no meaningful value to keep.
		fixed = fallback;
	} else {
		// Clamping also handles +/- infinity. Floor removes fractions.
		fixed = math.clamp(math.floor(value), min, max);
	}
	if (fixed !== value) {
		target[key] = fixed;
		repairs.push(path);
	}
}

/** Same as repairInteger but for real numbers (timestamps). */
export function repairNumber(
	target: PlainTable,
	key: string,
	min: number,
	max: number,
	fallback: number,
	path: string,
	repairs: string[],
): void {
	const value = target[key];
	const fixed = !typeIs(value, "number") || value !== value ? fallback : math.clamp(value, min, max);
	if (fixed !== value) {
		target[key] = fixed;
		repairs.push(path);
	}
}

/** Makes sure `target[key]` is a table (not an array check, just "is a table"). Returns it. */
export function repairTable(target: PlainTable, key: string, path: string, repairs: string[]): PlainTable {
	const value = target[key];
	if (typeIs(value, "table")) {
		return value as PlainTable;
	}
	const fresh: PlainTable = {};
	target[key] = fresh;
	repairs.push(path);
	return fresh;
}

/**
 * Repairs a map of `id -> count` for the given known ids. Unknown keys are left alone, so data written by a
 * newer server version (with new ids) is not destroyed; game logic only ever reads the known ids.
 */
export function repairCountMap(
	target: PlainTable,
	key: string,
	knownIds: ReadonlyArray<string>,
	path: string,
	repairs: string[],
): void {
	const map = repairTable(target, key, path, repairs);
	for (const id of knownIds) {
		if (map[id] !== undefined) {
			repairInteger(map, id, 0, MAX_COUNTER, 0, `${path}.${id}`, repairs);
		}
	}
}
