// Remote names and distances of the tycoon line. Buying a machine and dropping ore use ProximityPrompts on the
// machine models (handled on the server); upgrades come from the UI through this remote.

/** Client -> server: (index: integer, track: "speed" | "duplicate" | "quality" | "capacity"). Near that own machine. */
export const UPGRADE_LINE_MACHINE_REMOTE = "UpgradeLineMachine";

/** How close (studs) the player must be to a machine model of their own plot. Machine models are big. */
export const LINE_DISTANCE = 30;
