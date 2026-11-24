// Small helpers for JSON-like data (tables of numbers, strings, booleans and nested tables).
// Used for player data, which must never contain cycles, functions or Instances.

export type PlainTable = { [key: string]: unknown };

function isTable(value: unknown): value is PlainTable {
	return typeIs(value, "table");
}

// A table with a [1] entry is an array. Empty tables count as objects, which is harmless for our use.
function hasArrayPart(value: PlainTable): boolean {
	return (value as unknown as defined[]).size() > 0;
}

/**
 * Deep copy. Needed so a failed migration can never leave half-changed player data behind:
 * we always migrate a copy and only keep it if every step worked.
 */
export function deepCopy<T>(value: T): T {
	if (!isTable(value)) {
		return value;
	}
	const source: PlainTable = value;
	const copy: PlainTable = {};
	for (const [key, child] of pairs(source)) {
		copy[key] = deepCopy(child);
	}
	// The copy has the same shape as the input, TypeScript just cannot see that through the loop.
	return copy as unknown as T;
}

/**
 * Adds keys that exist in `defaults` but are missing in `target`, recursively for nested objects.
 * Never overwrites or deletes anything that is already there, so unknown keys written by a newer
 * server version survive. Arrays are left alone: array defaults should be empty.
 */
export function fillMissing(target: PlainTable, defaults: PlainTable): void {
	for (const [key, defaultValue] of pairs(defaults)) {
		const current = target[key];
		if (current === undefined) {
			target[key] = deepCopy(defaultValue);
		} else if (isTable(current) && isTable(defaultValue) && !hasArrayPart(current) && !hasArrayPart(defaultValue)) {
			fillMissing(current, defaultValue);
		}
	}
}
