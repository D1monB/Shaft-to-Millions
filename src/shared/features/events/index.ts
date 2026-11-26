// events feature (shared): cave-ins, shared crystal clusters and the timed raid (decision 065).
// Public API of this feature. Other code imports only from this file.
export {
	addRaidOre,
	caveInHits,
	clusterCrystals,
	clusterHit,
	finishRaid,
	newCluster,
	newRaidState,
	raidCooldownLeft,
	startRaid,
	weekOf,
} from "./events";
export type { ClusterHit, ClusterState, RaidResult, RaidRun, RaidState } from "./events";

/** Client -> server: no arguments. Starts a timed raid. */
export const START_RAID_REMOTE = "StartRaid";
/** Server -> client: (rows: {name, score}[], week) the weekly raid top. */
export const RAID_TOP_REMOTE = "RaidTop";
/** Player attributes (server-set) of a running raid: end time (unix) and score so far. */
export const RAID_ENDS_ATTRIBUTE = "RaidEndsAt";
export const RAID_SCORE_ATTRIBUTE = "RaidScore";

export interface RaidRow {
	readonly name: string;
	readonly score: number;
}
