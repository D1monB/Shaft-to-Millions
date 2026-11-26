/** Client -> server: (layer: number). Buy the drill of a layer. At its DrillSite. */
export const BUY_DRILL_REMOTE = "BuyDrill";
/** Client -> server: (layer: number, oreId: string). Choose what the drill mines. At its DrillSite. */
export const SELECT_DRILL_ORE_REMOTE = "SelectDrillOre";
/** Client -> server: (layer: number). Buy the next level of the owned drill (decision 059). At its DrillSite. */
export const UPGRADE_DRILL_REMOTE = "UpgradeDrill";

export const DRILL_DISTANCE = 18;
