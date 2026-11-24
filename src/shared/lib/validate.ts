// Runtime checks for values that come from outside our control (clients, old saves).
// TypeScript types do not exist at runtime, so every remote argument goes through one of these.

/** A real number: not NaN, not +/- infinity. `value === value` is false only for NaN. */
export function isFiniteNumber(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value > -math.huge && value < math.huge;
}

/** A whole number in [min, max]. */
export function isIntegerInRange(value: unknown, min: number, max: number): value is number {
	return isFiniteNumber(value) && math.floor(value) === value && value >= min && value <= max;
}

/** True if `value` is one of the keys of `record`. Used to check ids sent by a client. */
export function isKeyOf<T extends object>(record: T, value: unknown): value is keyof T {
	return typeIs(value, "string") && (record as Record<string, unknown>)[value] !== undefined;
}

/** A short string (ids, uids). The length cap stops a client from sending megabytes. */
export function isShortString(value: unknown, maxLength = 64): value is string {
	return typeIs(value, "string") && value.size() > 0 && value.size() <= maxLength;
}
