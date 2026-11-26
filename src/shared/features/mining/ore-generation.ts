// Which spawn points hold ore (decision 038). Pure: the server passes its Random as `nextNumber`, tests pass a fake.

/** How many of `total` points hold ore at `fraction` fill: at least one while there are points, never more than all. */
export function activeCount(total: number, fraction: number): number {
	if (!(total >= 1) || total === math.huge || !(fraction > 0)) {
		return 0;
	}
	const whole = math.floor(total);
	return math.clamp(math.round(whole * math.min(fraction, 1)), 1, whole);
}

/**
 * `count` different items picked at random (a partial Fisher-Yates shuffle, so every item has the same chance).
 * `nextNumber` should return [0, 1); anything else is clamped, so a broken generator cannot pick out of range.
 */
export function pickRandom<T extends defined>(
	items: ReadonlyArray<T>,
	count: number,
	nextNumber: () => number,
): Array<T> {
	const pool = [...items];
	const wanted = count === count && count > 0 ? math.min(math.floor(count), pool.size()) : 0;
	const picked = new Array<T>();
	for (let index = 0; index < wanted; index++) {
		const raw = nextNumber();
		const unit = raw === raw ? math.clamp(raw, 0, 0.999999) : 0;
		const chosen = index + math.floor(unit * (pool.size() - index));
		const item = pool[chosen];
		pool[chosen] = pool[index];
		pool[index] = item;
		picked.push(item);
	}
	return picked;
}
