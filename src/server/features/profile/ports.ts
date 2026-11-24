import { ProfileData } from "shared/features/profile";

// The session manager talks to the DataStore only through these two small interfaces.
// Why: the real implementation needs Roblox, the manager's logic (races, kicks, releasing sessions)
// is where data loss and duplication bugs live, and with ports we can test that logic headless.

export interface ProfileSession {
	/** True while this server still owns the profile. Turns false if another server takes it. */
	readonly isActive: () => boolean;
	/** The raw saved table, exactly as stored. May be old, damaged or from a newer version. */
	readonly getData: () => unknown;
	/** Replaces the saved table with checked data. Whatever is assigned here is what gets saved. */
	readonly replaceData: (data: ProfileData) => void;
	/** Saves one last time and releases the profile so another server can load it. */
	readonly end: () => void;
	/**
	 * Saves now and yields until the save is confirmed or `timeoutSeconds` pass. True if it was saved.
	 * Used before acknowledging a Robux purchase, so a granted item is never lost to a crash.
	 */
	readonly saveAndWait: (timeoutSeconds: number) => boolean;
	/** Called when this server loses ownership (e.g. the player joined another server). */
	readonly onSessionEnd: (callback: () => void) => void;
}

export interface ProfileBackend {
	/**
	 * Yields until the profile is locked to this server. Returns undefined if that is not possible:
	 * `shouldCancel` returned true, the server is shutting down, or the DataStore failed.
	 */
	readonly startSession: (key: string, shouldCancel: () => boolean) => ProfileSession | undefined;
}
