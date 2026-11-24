import ProfileStore from "@rbxts/profile-store";
import { ProfileData, createDefaultProfileData } from "shared/features/profile";
import { ProfileBackend, ProfileSession } from "./ports";

// Changing this name would make every existing save invisible. Schema changes use schemaVersion instead.
const PROFILE_STORE_NAME = "PlayerData";

/**
 * Real implementation of ProfileBackend. ProfileStore gives us session locking, auto-save and the
 * final save on server shutdown (it hooks game:BindToClose itself). Studio without API access
 * uses a temporary in-memory store, so nothing is persisted there.
 */
export function createRobloxBackend(): ProfileBackend {
	// The template is what a brand-new player starts with.
	const store = ProfileStore.New<ProfileData>(PROFILE_STORE_NAME, createDefaultProfileData());

	return {
		startSession: (key, shouldCancel): ProfileSession | undefined => {
			// The typings say this always returns a profile, but ProfileStore returns nil when it
			// is cancelled, shutting down, or the DataStore keeps failing.
			const profile: ProfileStore.Profile<ProfileData> | undefined = store.StartSessionAsync(key, {
				Cancel: shouldCancel,
			});
			if (profile === undefined) {
				return undefined;
			}
			return {
				isActive: () => profile.IsActive(),
				getData: () => profile.Data,
				replaceData: (data) => {
					profile.Data = data;
				},
				end: () => profile.EndSession(),
				onSessionEnd: (callback) => {
					profile.OnSessionEnd.Connect(callback);
				},
			};
		},
	};
}
