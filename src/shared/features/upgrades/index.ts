// upgrades feature (shared): ordered gear levels (pickaxe, bag) and the rules for buying the next one.
// Public API of this feature. Other code imports only from this file.
export { UPGRADE_TRACKS, UPGRADE_TRACK_IDS, isUpgradeTrack, maxLevel, nextLevelDef, tryBuyUpgrade } from "./upgrades";
export type { BuyResult, UpgradeLevels, UpgradeTrack } from "./upgrades";
export { BUY_UPGRADE_REMOTE, SHOP_DISTANCE } from "./network";
