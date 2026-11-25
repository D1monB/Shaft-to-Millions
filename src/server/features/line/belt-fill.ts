// Belt filler and buy signs for machine places that are not bought yet (developer's design 2026-11-25).
// The map author's belt has a gap at every machine place. Until the machine is bought, the gap is covered by copies of
// the nearest straight belt piece (same look, same ConveyorFlow and tags, so the author's animator moves them too),
// and a sign beside the belt shows the machine and its price. Buying puts the machine in place of the filler.
// Geometry is worked out once per template Factory, in template space; plots apply their own transform.
import {
	BeltPiece,
	Span,
	chainPoints,
	cornerPiece,
	gapAround,
	nearestIndex,
	orderPieces,
	splitStretch,
	straightPiece,
} from "shared/features/line";
import { PLOTS, PLOT_ATTRIBUTES } from "shared/config/map-contract";

/** One filler piece in template space: which belt part to copy, where it goes and its new size. */
export interface FillPiece {
	readonly source: BasePart;
	readonly cframe: CFrame;
	readonly size: Vector3;
}

/** What a machine place gets while the machine is not bought. */
export interface SlotFill {
	readonly pieces: ReadonlyArray<FillPiece>;
	/** Where the sign stands (template space), its front facing the walkway. */
	readonly sign: CFrame;
}

const STRAIGHT = "Conveyor_Straight";
/** Belt pieces farther than this from the machine along the belt do not bound its gap (studs). */
const MAX_REACH = 60;
/** Gap between the machine's side and the sign (studs). */
const SIGN_MARGIN = 3;

function horizontal(vector: Vector3): Vector3 {
	const flat = new Vector3(vector.X, 0, vector.Z);
	return flat.Magnitude > 1e-4 ? flat.Unit : new Vector3(1, 0, 0);
}

/** Half the length of a box along a world direction (works for any rotation). */
function halfExtent(cframe: CFrame, size: Vector3, axis: Vector3): number {
	return (
		(math.abs(cframe.RightVector.Dot(axis)) * size.X +
			math.abs(cframe.UpVector.Dot(axis)) * size.Y +
			math.abs(cframe.LookVector.Dot(axis)) * size.Z) /
		2
	);
}

/** The part's long horizontal axis (a straight belt piece is longer than it is wide). */
function longAxisOf(part: BasePart): { axis: Vector3; length: number; useX: boolean } {
	const useX = part.Size.X >= part.Size.Z;
	return {
		axis: horizontal(useX ? part.CFrame.RightVector : part.CFrame.LookVector),
		length: useX ? part.Size.X : part.Size.Z,
		useX,
	};
}

function fillFor(machine: Model, belt: ReadonlyArray<BasePart>, walkway: Vector3): SlotFill | undefined {
	const [box, boxSize] = machine.GetBoundingBox();
	const center = box.Position;
	// The straight piece nearest to the machine gives the belt direction, height and look of the filler.
	let source: BasePart | undefined;
	let best = math.huge;
	for (const part of belt) {
		const flat = new Vector3(part.Position.X - center.X, 0, part.Position.Z - center.Z).Magnitude;
		if (part.Name === STRAIGHT && flat < best) {
			best = flat;
			source = part;
		}
	}
	if (source === undefined) {
		return undefined;
	}
	const { axis, length: pieceLength, useX } = longAxisOf(source);
	const across = horizontal(axis.Cross(Vector3.yAxis));
	// The belt line runs through the source piece; pieces off that line (a parallel run) do not bound the gap.
	const lineOffset = source.Position.sub(center).Dot(across);
	const beltHalfWidth = halfExtent(source.CFrame, source.Size, across);
	const spans: Span[] = [];
	for (const part of belt) {
		const offset = part.Position.sub(center);
		if (math.abs(offset.Dot(across) - lineOffset) > beltHalfWidth) {
			continue;
		}
		const middle = offset.Dot(axis);
		const half = halfExtent(part.CFrame, part.Size, axis);
		spans.push({ from: middle - half, to: middle + half });
	}
	const gap = gapAround(0, spans, halfExtent(box, boxSize, axis), MAX_REACH);
	if (gap === undefined) {
		return undefined;
	}
	const lineOrigin = center.add(across.mul(lineOffset));
	const rotation = source.CFrame.sub(source.Position);
	const pieces: FillPiece[] = [];
	let at = gap.from;
	for (const piece of splitStretch(gap.to - gap.from, pieceLength)) {
		const middle = lineOrigin.add(axis.mul(at + piece / 2));
		const position = new Vector3(middle.X, source.Position.Y, middle.Z);
		const size = useX
			? new Vector3(piece, source.Size.Y, source.Size.Z)
			: new Vector3(source.Size.X, source.Size.Y, piece);
		pieces.push({ source, cframe: rotation.add(position), size });
		at += piece;
	}
	// The sign stands beside the machine on the walkway side, facing the walkway.
	const side = walkway.sub(center).Dot(across) >= 0 ? 1 : -1;
	const gapMiddle = lineOrigin.add(axis.mul((gap.from + gap.to) / 2));
	// Foot on the walkway's height: a machine's bounding box may reach below the floor, so its bottom is no guide.
	const signAt = new Vector3(gapMiddle.X, walkway.Y, gapMiddle.Z).add(
		across.mul(side * (halfExtent(box, boxSize, across) + SIGN_MARGIN)),
	);
	const sign = CFrame.lookAt(signAt, signAt.add(across.mul(side)));
	return { pieces, sign };
}

/**
 * Filler and sign spots for every machine place of a template Factory.
 * @param walkway a point where players walk (the plot spawn), to put signs on the near side of the belt
 */
export function computeFills(
	factory: Instance,
	machines: ReadonlyMap<number, Model>,
	walkway: Vector3,
): Map<number, SlotFill> {
	const belt = (factory.FindFirstChild(PLOTS.Conveyors)?.GetDescendants() ?? []).filter((child): child is BasePart =>
		child.IsA("BasePart"),
	);
	const fills = new Map<number, SlotFill>();
	for (const [stage, machine] of machines) {
		const fill = fillFor(machine, belt, walkway);
		if (fill !== undefined) {
			fills.set(stage, fill);
		} else {
			warn(`[line] no belt filler for machine ${stage}: no straight belt piece found near it`);
		}
	}
	return fills;
}

/** Lays the filler of one machine place into `parent`, moved onto the plot by `transform`. */
export function layFiller(fill: SlotFill, transform: CFrame, parent: Instance): void {
	for (const piece of fill.pieces) {
		const copy = piece.source.Clone();
		copy.ClearAllChildren();
		// Keep the look (SurfaceAppearance) but nothing else that may hang under a belt part (welds, scripts).
		for (const child of piece.source.GetChildren()) {
			if (child.IsA("SurfaceAppearance") || child.IsA("Texture") || child.IsA("Decal")) {
				child.Clone().Parent = copy;
			}
		}
		copy.Anchored = true;
		copy.Size = piece.size;
		copy.CFrame = transform.mul(piece.cframe);
		copy.Parent = parent;
	}
}

/** The belt as one ordered path in template space, with where each machine and the SellStation sit on it. */
export interface BeltPath {
	/** Points on top of the belt, from the start of the line to its end. */
	readonly points: ReadonlyArray<Vector3>;
	/** Path index nearest to each machine place, by stage (1..12). */
	readonly machines: ReadonlyMap<number, number>;
	/** Path index nearest to the SellStation, or -1. */
	readonly sell: number;
}

function toVec(point: Vector3) {
	return { x: point.X, y: point.Y, z: point.Z };
}

/** Joints of neighbouring pieces may be this far apart (studs): our fillers do not always meet a corner exactly. */
const MAX_JOINT_GAP = 8;
/** Path points closer than this to the previous one are dropped (studs). */
const MIN_PATH_STEP = 0.5;

/** The way an item travels over one belt part, or undefined for a part that carries nothing (no ConveyorFlow). */
function pieceOf(part: BasePart, cframe: CFrame, size: Vector3): BeltPiece | undefined {
	const flow = part.GetAttribute(PLOT_ATTRIBUTES.ConveyorFlow);
	if (!typeIs(flow, "number")) {
		return undefined;
	}
	const top = toVec(cframe.Position.add(new Vector3(0, size.Y / 2, 0)));
	const xAxis = toVec(cframe.RightVector);
	// The same rule as the author's animator: a part with "Corner" in its name is a quarter turn.
	return part.Name.find("Corner")[0] !== undefined
		? cornerPiece(top, xAxis, toVec(cframe.LookVector.mul(-1)), flow)
		: straightPiece(top, xAxis, size.X, flow);
}

/**
 * Orders the belt pieces (the author's conveyors and our fillers) into one path from the head of the belt to its
 * end, following each piece's direction of travel.
 */
export function computeBeltPath(
	factory: Instance,
	machines: ReadonlyMap<number, Model>,
	fills: ReadonlyMap<number, SlotFill>,
): BeltPath | undefined {
	const pieces: BeltPiece[] = [];
	for (const part of factory.FindFirstChild(PLOTS.Conveyors)?.GetDescendants() ?? []) {
		if (part.IsA("BasePart")) {
			const piece = pieceOf(part, part.CFrame, part.Size);
			if (piece !== undefined) {
				pieces.push(piece);
			}
		}
	}
	for (const [, fill] of fills) {
		for (const filler of fill.pieces) {
			const piece = pieceOf(filler.source, filler.cframe, filler.size);
			if (piece !== undefined) {
				pieces.push(piece);
			}
		}
	}
	const first = machines.get(1);
	if (first === undefined || pieces.size() === 0) {
		return undefined;
	}
	const order = orderPieces(pieces, toVec(first.GetBoundingBox()[0].Position), MAX_JOINT_GAP);
	const orderedVecs = chainPoints(pieces, order, MIN_PATH_STEP);
	if (orderedVecs.size() === 0) {
		return undefined;
	}
	const ordered = orderedVecs.map((point) => new Vector3(point.x, point.y, point.z));
	const machineIndex = new Map<number, number>();
	for (const [stage, machine] of machines) {
		machineIndex.set(stage, nearestIndex(orderedVecs, toVec(machine.GetBoundingBox()[0].Position)));
	}
	const sellStation = factory.FindFirstChild("SellStation");
	const sell =
		sellStation !== undefined && sellStation.IsA("Model")
			? nearestIndex(orderedVecs, toVec(sellStation.GetPivot().Position))
			: -1;
	if (order.size() < pieces.size()) {
		warn(`[line] belt path covers ${order.size()} of ${pieces.size()} belt pieces: some items may skip a stretch`);
	}
	// Places must follow each other along the belt, or items would not ride between them.
	let previous = -1;
	for (let stage = 1; stage <= machines.size(); stage++) {
		const index = machineIndex.get(stage) ?? -1;
		if (index <= previous) {
			warn(`[line] machine ${stage} is not after the one before it on the belt path`);
		}
		previous = index;
	}
	if (sell >= 0 && sell <= previous) {
		warn("[line] the SellStation is not after the last machine on the belt path");
	}
	return { points: ordered, machines: machineIndex, sell };
}
