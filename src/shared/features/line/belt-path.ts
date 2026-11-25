// The belt as one ordered path, for the visuals of items riding it. Pure math on plain numbers, so it runs under
// Lune: the server passes the centres of the belt pieces, gets back their order from the start of the line to its
// end, and where each machine and the SellStation sit on that order.

export interface Vec3 {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

function isFiniteNumber(value: number): boolean {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

function isFiniteVec(point: Vec3): boolean {
	return isFiniteNumber(point.x) && isFiniteNumber(point.y) && isFiniteNumber(point.z);
}

function flatDistance(a: Vec3, b: Vec3): number {
	const dx = a.x - b.x;
	const dz = a.z - b.z;
	return math.sqrt(dx * dx + dz * dz);
}

/** Index of the point nearest to `target` (on the ground plane), or -1 for an empty or broken list. */
export function nearestIndex(points: ReadonlyArray<Vec3>, target: Vec3): number {
	if (!isFiniteVec(target)) {
		return -1;
	}
	let best = -1;
	let bestDistance = math.huge;
	for (let i = 0; i < points.size(); i++) {
		const point = points[i];
		if (!isFiniteVec(point)) {
			continue;
		}
		const distance = flatDistance(point, target);
		if (distance < bestDistance) {
			bestDistance = distance;
			best = i;
		}
	}
	return best;
}

/**
 * Orders belt piece centres into one chain: starts at the piece nearest `start`, then repeatedly steps to the nearest
 * unused piece no farther than `maxLink`. Stops when no piece is close enough (the end of the belt). Pieces not on
 * the chain (a stray decoration) are left out. Returns indexes into `points`.
 */
export function orderChain(points: ReadonlyArray<Vec3>, start: Vec3, maxLink: number): number[] {
	const first = nearestIndex(points, start);
	if (first < 0 || !isFiniteNumber(maxLink) || maxLink <= 0) {
		return [];
	}
	const used = new Set<number>([first]);
	const chain = [first];
	let current = points[first];
	for (;;) {
		let best = -1;
		let bestDistance = maxLink;
		for (let i = 0; i < points.size(); i++) {
			if (used.has(i) || !isFiniteVec(points[i])) {
				continue;
			}
			const distance = flatDistance(points[i], current);
			if (distance <= bestDistance) {
				bestDistance = distance;
				best = i;
			}
		}
		if (best < 0) {
			return chain;
		}
		used.add(best);
		chain.push(best);
		current = points[best];
	}
}

/** The points of the path from chain position `from` to `to` (inclusive), in travel order. Empty for bad input. */
export function pathBetween(path: ReadonlyArray<Vec3>, from: number, to: number): Vec3[] {
	if (from < 0 || to < 0 || from >= path.size() || to >= path.size() || from % 1 !== 0 || to % 1 !== 0) {
		return [];
	}
	const result: Vec3[] = [];
	const step = to >= from ? 1 : -1;
	for (let i = from; ; i += step) {
		result.push(path[i]);
		if (i === to) {
			return result;
		}
	}
}

/** The belt path of one plot as the server stores it (BeltPath StringValue), checked and in plain numbers. */
export interface StoredBeltPath {
	readonly points: ReadonlyArray<Vec3>;
	/** Path index of machine stage 1..N (array position = stage - 1), -1 if unknown. */
	readonly machines: ReadonlyArray<number>;
	/** Path index of the SellStation, -1 if unknown. */
	readonly sell: number;
}

function isIndex(value: unknown, size: number): value is number {
	return typeIs(value, "number") && value === value && value % 1 === 0 && value >= -1 && value < size;
}

/**
 * Checks a decoded BeltPath JSON ({ p: [x, y, z, ...], m: [index...], s: index }). Returns undefined for anything
 * malformed, so a broken value only hides the belt items instead of breaking the client.
 */
export function parseBeltPath(decoded: unknown): StoredBeltPath | undefined {
	if (!typeIs(decoded, "table")) {
		return undefined;
	}
	const data = decoded as { p?: unknown; m?: unknown; s?: unknown };
	if (!typeIs(data.p, "table") || !typeIs(data.m, "table")) {
		return undefined;
	}
	const flat = data.p as Array<unknown>;
	if (flat.size() === 0 || flat.size() % 3 !== 0) {
		return undefined;
	}
	const points: Vec3[] = [];
	for (let i = 0; i < flat.size(); i += 3) {
		const [x, y, z] = [flat[i], flat[i + 1], flat[i + 2]];
		if (!typeIs(x, "number") || !typeIs(y, "number") || !typeIs(z, "number")) {
			return undefined;
		}
		const point = { x, y, z };
		if (!isFiniteVec(point)) {
			return undefined;
		}
		points.push(point);
	}
	const machines: number[] = [];
	for (const index of data.m as Array<unknown>) {
		if (!isIndex(index, points.size())) {
			return undefined;
		}
		machines.push(index);
	}
	const sell = isIndex(data.s, points.size()) ? data.s : -1;
	return { points, machines, sell };
}

/** Where one item rides on screen: from path index `start` to `target`, shown as the model of `stage` (0 = raw). */
export interface BeltRoute {
	readonly start: number;
	readonly target: number;
	readonly stage: number;
}

/**
 * The ride of an item that left place `from` of a line with `owned` machines (see LineMove): raw ore (-1) goes from
 * the start of the belt to machine 1, or to the SellStation without machines; the output of machine i goes to
 * machine i + 1, or to the SellStation after the last one. Undefined when the plot lacks a place or nothing moves.
 */
export function routeFor(path: StoredBeltPath, from: number, owned: number): BeltRoute | undefined {
	if (!typeIs(from, "number") || from % 1 !== 0 || from < -1 || !typeIs(owned, "number") || owned % 1 !== 0) {
		return undefined;
	}
	if (from >= owned || from >= path.machines.size()) {
		return undefined;
	}
	const start = from === -1 ? 0 : path.machines[from];
	const nextStage = from + 1;
	const target = nextStage < owned && nextStage < path.machines.size() ? path.machines[nextStage] : path.sell;
	if (start === undefined || target === undefined || start < 0 || target < 0 || start === target) {
		return undefined;
	}
	return { start, target, stage: from + 1 };
}
