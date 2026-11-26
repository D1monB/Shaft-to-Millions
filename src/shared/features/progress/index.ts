// progress feature (shared): what keeps players coming back (decision 070): the guide, calendar, rebirth, titles,
// friend bonus, live events and taming. Public API of this feature. Other code imports only from this file.
export { calendarReward, canClaimCalendar, claimCalendarDay, newCalendarState } from "./calendar";
export type { CalendarState, DayReward } from "./calendar";
export { REBIRTH_REWARD_CRYSTALS, canRebirth, rebirthMultiplier, rebirthPrice } from "./rebirth";
export { ACHIEVEMENTS, findAchievement, isUnlocked } from "./titles";
export type { AchievementDef, AchievementMetric, AchievementStats } from "./titles";
export { TUTORIAL_ORE, menuUnlocked, tutorialStep } from "./tutorial";
export type { TutorialStats, TutorialStep } from "./tutorial";
export { liveBonuses, liveEventAt } from "./live-events";
export type { LiveBonuses } from "./live-events";
export { friendBonus } from "./social";
export { canOffer, creatureOfLayer, tames } from "./taming";
export type { TameCheck } from "./taming";
export { statsOfProfile, tutorialStatsOf } from "./stats";

/** Client -> server: () claims today's calendar square. */
export const CLAIM_CALENDAR_REMOTE = "ClaimCalendar";
/** Client -> server: () starts over for a permanent money bonus. */
export const REBIRTH_REMOTE = "Rebirth";
/** Client -> server: (achievementId | "") the title shown over the head. */
export const SET_TITLE_REMOTE = "SetTitle";
/** Client -> server: () the player closed the newcomer guide. */
export const CLOSE_GUIDE_REMOTE = "CloseGuide";
/** Player attribute: the achievement id of the title over the head. */
export const TITLE_ATTRIBUTE = "Title";
/** Player attribute: money bonus from friends on this server (0.2 = +20%). */
export const FRIEND_BONUS_ATTRIBUTE = "FriendBonus";
/** Tag and attribute of a wild creature that can be tamed. */
export const CREATURE_TAG = "TameCreature";
export const CREATURE_LAYER_ATTRIBUTE = "CreatureLayer";
