// Remote names and distances of the tycoon line. Buying a machine and dropping ore use ProximityPrompts on the
// machine models (handled on the server); upgrades come from the UI through this remote.

/** Client -> server: (index: integer, track: "speed" | "duplicate" | "quality" | "capacity"). Near that own machine. */
export const UPGRADE_LINE_MACHINE_REMOTE = "UpgradeLineMachine";

/** Client -> server: no arguments. Buys the next conveyor level (decision 054). Near any own machine. */
export const UPGRADE_BELT_REMOTE = "UpgradeBelt";

/** How close (studs) the player must be to a machine model of their own plot. Machine models are big. */
export const LINE_DISTANCE = 30;

/**
 * Server -> all clients, unreliable, visuals only: (plotIndex: number, moves: number[]) where moves is a flat list
 * [oreIndex, from, oreIndex, from, ...]; oreIndex into ORE_IDS, from as in LineMove (-1 = start of the belt).
 */
export const LINE_FLOW_REMOTE = "LineFlow";

/** Name of the StringValue in a built plot Factory that holds the belt path as JSON (see plots.ts). */
export const BELT_PATH_VALUE = "BeltPath";

/** Folder in ReplicatedStorage with the map author's item models, copied from ServerStorage at server start. */
export const ITEM_TEMPLATES_FOLDER = "ItemTemplates";

/**
 * CollectionService tag of the invisible point at every bought machine (set by the server). Its prompt opens the
 * upgrade panel on the owner's client and the progress bar hangs above it. Attributes: Stage and LabelHeight.
 */
export const UPGRADE_POINT_TAG = "LineUpgradePoint";

/** On an upgrade point: how far above it (studs) the progress bar goes (just over the top of the machine). */
export const LABEL_HEIGHT_ATTRIBUTE = "LabelHeight";
