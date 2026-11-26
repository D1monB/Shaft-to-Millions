// quests feature (server): counts quest events reported by other features and pays claimed rewards.
// Public API of this feature. Other code imports only from this file.
export { startQuestsService, trackQuest } from "./quests-service";
