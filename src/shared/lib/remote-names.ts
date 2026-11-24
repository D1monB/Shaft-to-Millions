// Names shared by server and client. Each feature keeps its own remote names in its network.ts;
// only the names used by the core plumbing live here.

/** Folder in ReplicatedStorage that holds every RemoteEvent. */
export const REMOTES_FOLDER_NAME = "Remotes";

/** Server -> client: the player's full view (their own data). */
export const STATE_UPDATE_REMOTE = "StateUpdate";

/** Server -> client: a short message for the player, e.g. "Bag is full". */
export const NOTIFY_REMOTE = "Notify";

export type NotifyKind = "info" | "success" | "error";
