// Pets that float around their owner. The server only PUBLISHES which pets a player has equipped (a Player attribute);
// every client draws and moves them itself. Pure: the math here runs in unit tests, the client only applies it.
import { ITEMS, ItemId, isItemId } from "shared/config/items";
import { MAX_PETS } from "./equipment";

/** Player attribute with the equipped pet item ids, written by the server only. */
export const PETS_ATTRIBUTE = "EquippedPets";

const SEPARATOR = ",";

export function encodePets(itemIds: ReadonlyArray<ItemId>): string {
	return itemIds.join(SEPARATOR);
}

/**
 * Reads the attribute defensively: unknown ids, non-pets, other types and too many pets are dropped, so a
 * strange value can never make the client draw something it should not or loop forever.
 */
export function decodePets(value: unknown): ItemId[] {
	if (!typeIs(value, "string")) {
		return [];
	}
	const result: ItemId[] = [];
	for (const part of value.split(SEPARATOR)) {
		if (isItemId(part) && ITEMS[part].kind === "pet" && result.size() < MAX_PETS) {
			result.push(part);
		}
	}
	return result;
}

export interface PetOffset {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

/** Studs between two pets side by side. */
const PET_SPACING = 2.6;
/** Studs above the owner's root part, and how far the pets bob up and down around it. */
const PET_HEIGHT = 2;
const PET_BOB = 0.45;
/** Studs behind the owner (the character faces -Z, so behind is +Z). */
const PET_DISTANCE_BEHIND = 3.2;

/**
 * Where pet number `index` (0-based) of `count` floats, relative to the owner's root part.
 * The pets fan out behind the owner and bob a little, each on its own beat so they do not move in lockstep.
 */
export function petOffset(index: number, count: number, time: number): PetOffset {
	const safeTime = time === time && time > -math.huge && time < math.huge ? time : 0;
	const safeCount = count === count && count >= 1 ? math.min(math.floor(count), MAX_PETS) : 1;
	const safeIndex = index === index ? math.clamp(math.floor(index), 0, safeCount - 1) : 0;
	return {
		x: (safeIndex - (safeCount - 1) / 2) * PET_SPACING,
		y: PET_HEIGHT + math.sin(safeTime * 2.2 + safeIndex * 1.7) * PET_BOB,
		z: PET_DISTANCE_BEHIND + math.cos(safeTime * 1.3 + safeIndex) * 0.3,
	};
}

/**
 * How far a pet moves toward its target this frame (0..1). The exponential form gives the same feel at 30 and 144 fps,
 * unlike a fixed fraction per frame. A broken delta moves nothing.
 */
export function followAlpha(deltaSeconds: number, rate: number): number {
	if (!(deltaSeconds > 0) || !(rate > 0) || deltaSeconds === math.huge || rate === math.huge) {
		return 0;
	}
	return math.clamp(1 - math.exp(-rate * deltaSeconds), 0, 1);
}
