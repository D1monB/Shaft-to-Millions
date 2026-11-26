/**
 * Client -> server: (what: "daily" | "allDone" | "chain" | "streak", index?: integer). Claims a quest reward.
 * The server checks that the quest is done and not claimed yet; the client never sends progress.
 */
export const CLAIM_QUEST_REMOTE = "ClaimQuest";

export type ClaimWhat = "daily" | "allDone" | "chain" | "streak" | "skip";

export function isClaimWhat(value: unknown): value is ClaimWhat {
	return value === "daily" || value === "allDone" || value === "chain" || value === "streak" || value === "skip";
}
