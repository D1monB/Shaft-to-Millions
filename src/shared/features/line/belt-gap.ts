// Where to lay belt filler under a machine that is not bought yet. The map author's belt has a gap at every machine
// place; until the machine is bought the gap is filled with copies of a straight belt piece, so the belt looks whole.
// Pure 1D math along the belt axis, so it runs under Lune: the server projects the belt pieces onto the axis and
// passes plain numbers.

/** A belt piece projected onto the belt axis: where it starts and ends. */
export interface Span {
	readonly from: number;
	readonly to: number;
}

function isFiniteNumber(value: number): boolean {
	return typeIs(value, "number") && value === value && value !== math.huge && value !== -math.huge;
}

/**
 * The free stretch of belt around `center` (the machine's place), between the nearest piece ending before it and the
 * nearest piece starting after it. A side with no piece within `maxReach` falls back to `fallbackHalf` from center
 * (a machine at the very start or end of the line). Returns undefined for broken input or an empty stretch.
 */
export function gapAround(
	center: number,
	pieces: ReadonlyArray<Span>,
	fallbackHalf: number,
	maxReach: number,
): Span | undefined {
	if (!isFiniteNumber(center) || !isFiniteNumber(fallbackHalf) || !isFiniteNumber(maxReach) || fallbackHalf <= 0) {
		return undefined;
	}
	let from = center - fallbackHalf;
	let to = center + fallbackHalf;
	let bestBefore = maxReach;
	let bestAfter = maxReach;
	for (const piece of pieces) {
		if (!isFiniteNumber(piece.from) || !isFiniteNumber(piece.to)) {
			continue;
		}
		const low = math.min(piece.from, piece.to);
		const high = math.max(piece.from, piece.to);
		// A piece covering the center means there is no gap here at all.
		if (low < center && high > center) {
			return undefined;
		}
		if (high <= center && center - high < bestBefore) {
			bestBefore = center - high;
			from = high;
		} else if (low >= center && low - center < bestAfter) {
			bestAfter = low - center;
			to = low;
		}
	}
	return to - from > 0.05 ? { from, to } : undefined;
}

/**
 * Splits a stretch into belt pieces of `pieceLength`, the last one shorter so they end exactly at the stretch end.
 * A tail shorter than a tenth of a piece is folded into the previous piece (no sliver parts).
 */
export function splitStretch(length: number, pieceLength: number, maxPieces = 32): number[] {
	if (!isFiniteNumber(length) || !isFiniteNumber(pieceLength) || length <= 0 || pieceLength <= 0) {
		return [];
	}
	const pieces: number[] = [];
	let left = length;
	while (left > 0.0001 && pieces.size() < maxPieces) {
		if (left < pieceLength * 1.1) {
			pieces.push(left);
			break;
		}
		pieces.push(pieceLength);
		left -= pieceLength;
	}
	return pieces;
}
