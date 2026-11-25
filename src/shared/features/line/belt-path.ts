// The belt as one ordered path, for the visuals of items riding it. Pure math on plain numbers, so it runs under
// Lune: the server describes each belt piece, gets back their order from the start of the line to its end,
// and where each machine and the SellStation sit on that order.

import { CORNER_CENTER_X, CORNER_CENTER_Z, CORNER_RADIUS, CORNER_SEGMENTS } from "./tuning";

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

/** One belt piece as the points an item passes on it, in travel order (the first is where it gets on). */
export interface BeltPiece {
	readonly points: ReadonlyArray<Vec3>;
}

function along(origin: Vec3, axis: Vec3, distance: number): Vec3 {
	return { x: origin.x + axis.x * distance, y: origin.y + axis.y * distance, z: origin.z + axis.z * distance };
}

/**
 * A straight piece. The map author's contract: items move along the part's local X axis, ConveyorFlow (+1 / -1)
 * gives the sense. `center` is the middle of the belt surface, `xAxis` a unit vector. Undefined for bad input.
 */
export function straightPiece(center: Vec3, xAxis: Vec3, length: number, flow: number): BeltPiece | undefined {
	if (!isFiniteVec(center) || !isFiniteVec(xAxis) || !isFiniteNumber(length) || length <= 0) {
		return undefined;
	}
	if (flow !== 1 && flow !== -1) {
		return undefined;
	}
	const half = (length / 2) * flow;
	return { points: [along(center, xAxis, -half), along(center, xAxis, half)] };
}

/**
 * A quarter-turn piece (the map author's contract): an arc of CORNER_RADIUS around CORNER_CENTER_X / _Z in the
 * part's local space, running from the end on its -X side to the end on its +Z side when ConveyorFlow is +1.
 */
export function cornerPiece(center: Vec3, xAxis: Vec3, zAxis: Vec3, flow: number): BeltPiece | undefined {
	if (!isFiniteVec(center) || !isFiniteVec(xAxis) || !isFiniteVec(zAxis) || (flow !== 1 && flow !== -1)) {
		return undefined;
	}
	const points: Vec3[] = [];
	for (let i = 0; i <= CORNER_SEGMENTS; i++) {
		const step = flow === 1 ? i : CORNER_SEGMENTS - i;
		const angle = (step / CORNER_SEGMENTS) * (math.pi / 2);
		const localX = CORNER_CENTER_X - CORNER_RADIUS * math.cos(angle);
		const localZ = CORNER_CENTER_Z + CORNER_RADIUS * math.sin(angle);
		points.push(along(along(center, xAxis, localX), zAxis, localZ));
	}
	return { points };
}

function entryOf(piece: BeltPiece): Vec3 {
	return piece.points[0];
}

function exitOf(piece: BeltPiece): Vec3 {
	return piece.points[piece.points.size() - 1];
}

/** The unused piece whose joint (given by `jointOf`) is nearest to `at` and no farther than `maxGap`, or -1. */
function neighbour(
	pieces: ReadonlyArray<BeltPiece>,
	at: Vec3,
	jointOf: (piece: BeltPiece) => Vec3,
	maxGap: number,
	used: Set<number>,
): number {
	let best = -1;
	let bestDistance = maxGap;
	for (let i = 0; i < pieces.size(); i++) {
		if (used.has(i) || pieces[i].points.size() < 2) {
			continue;
		}
		const joint = jointOf(pieces[i]);
		const distance = isFiniteVec(joint) ? flatDistance(joint, at) : math.huge;
		if (distance <= bestDistance) {
			bestDistance = distance;
			best = i;
		}
	}
	return best;
}

/**
 * Orders belt pieces from the head of the belt to its end, following the direction of travel. Starts at the piece
 * nearest `near`, walks back while some piece ends where the current one begins, then walks forward from that head.
 * Joints may be up to `maxGap` apart. Pieces not on this belt are left out. Returns indexes into `pieces`.
 */
export function orderPieces(pieces: ReadonlyArray<BeltPiece>, near: Vec3, maxGap: number): number[] {
	if (!isFiniteVec(near) || !isFiniteNumber(maxGap) || maxGap <= 0) {
		return [];
	}
	let first = -1;
	let firstDistance = math.huge;
	for (let i = 0; i < pieces.size(); i++) {
		if (pieces[i].points.size() < 2) {
			continue;
		}
		for (const point of pieces[i].points) {
			const distance = isFiniteVec(point) ? flatDistance(point, near) : math.huge;
			if (distance < firstDistance) {
				firstDistance = distance;
				first = i;
			}
		}
	}
	if (first < 0) {
		return [];
	}
	// `visited` also ends the backward walk on a closed loop.
	const visited = new Set<number>([first]);
	let head = first;
	for (;;) {
		const previous = neighbour(pieces, entryOf(pieces[head]), exitOf, maxGap, visited);
		if (previous < 0) {
			break;
		}
		visited.add(previous);
		head = previous;
	}
	const used = new Set<number>([head]);
	const chain = [head];
	for (;;) {
		const following = neighbour(pieces, exitOf(pieces[chain[chain.size() - 1]]), entryOf, maxGap, used);
		if (following < 0) {
			return chain;
		}
		used.add(following);
		chain.push(following);
	}
}

/** The points of the ordered pieces as one path; points closer than `minStep` to the previous one are merged. */
export function chainPoints(pieces: ReadonlyArray<BeltPiece>, order: ReadonlyArray<number>, minStep: number): Vec3[] {
	const result: Vec3[] = [];
	for (const index of order) {
		for (const point of pieces[index]?.points ?? []) {
			const last = result.size() > 0 ? result[result.size() - 1] : undefined;
			if (last === undefined || flatDistance(last, point) >= minStep) {
				result.push(point);
			}
		}
	}
	return result;
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
