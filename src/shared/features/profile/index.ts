// profile feature (shared): player data schema, version, migrations, validation and the client view.
// Pure logic, no Roblox API. The server feature `profile` does the actual loading and saving.
// Only the server may call loadProfileData and trust its result.
// Public API of this feature. Other code imports only from this file.
export { CURRENT_SCHEMA_VERSION, createDefaultProfileData, isProfileData } from "./schema";
export type { ProfileData, ProfileLevels, ProfileStats } from "./schema";
export { loadProfileData } from "./load-profile-data";
export type { LoadFailure, LoadResult } from "./load-profile-data";
export { toPlayerView } from "./view";
export type { PlayerView } from "./view";
