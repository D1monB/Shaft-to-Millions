import { PlainTable, deepCopy } from "shared/lib/tables";
import { ProfileData } from "./schema";

/**
 * Fields that are saved but never sent to the client. Receipt ids, for example, are bookkeeping that the
 * player has no use for. Everything else in the profile is the player's own data and safe to show.
 */
const PRIVATE_KEYS: ReadonlyArray<string> = ["purchaseIds", "redeemedCodes"];

/** What the client receives: a copy of the profile without private fields. Read-only for the client. */
export type PlayerView = ProfileData;

export function toPlayerView(data: ProfileData): PlayerView {
	const copy = deepCopy(data) as unknown as PlainTable;
	for (const key of PRIVATE_KEYS) {
		copy[key] = undefined;
	}
	return copy as unknown as PlayerView;
}
