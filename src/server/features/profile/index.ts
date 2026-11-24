// profile feature (server): loads, hands out and saves player data. The ONLY place that owns player data.
// Other features change the data they get from getProfileData() and then call markDirty() so the client updates.
// Public API of this feature. Other code imports only from this file.
export {
	getLoadedPlayers,
	getProfileData,
	markDirty,
	onProfileLoaded,
	saveProfileNow,
	startProfileService,
} from "./profile-service";
