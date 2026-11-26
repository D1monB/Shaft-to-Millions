// quests feature (shared): daily quests, the story chain and the login streak (decision 055).
// Public API of this feature. Other code imports only from this file.
export {
	claimAllDone,
	claimChain,
	claimDaily,
	claimStreak,
	dayOf,
	findDaily,
	isDone,
	newQuestState,
	pickDaily,
	questProgress,
	recordEvent,
	rollOver,
	scaledDaily,
	streakReward,
} from "./quests";
export type { ClaimResult, DailyEntry, QuestSnapshot, QuestState } from "./quests";
export { CLAIM_QUEST_REMOTE, isClaimWhat } from "./network";
export type { ClaimWhat } from "./network";
