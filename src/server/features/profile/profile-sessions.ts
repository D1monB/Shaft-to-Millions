import { ProfileData, loadProfileData } from "shared/features/profile";
import { ProfileBackend, ProfileSession } from "./ports";

const MESSAGE_LOAD_FAILED = "Your data could not be loaded. Please rejoin in a moment.";
const MESSAGE_DATA_PROBLEM = "Your data could not be read safely, so it was left untouched. Please contact support.";
const MESSAGE_SESSION_TAKEN = "Your data was opened on another server.";

interface ActiveSession {
	readonly session: ProfileSession;
	readonly data: ProfileData;
}

export function profileKey(userId: number): string {
	return `Player_${userId}`;
}

/**
 * Owns the lifecycle of every player's saved data on this server: load, hand out, release.
 * Contains no Roblox API calls (see ports.ts). It is the ONLY code that starts or ends sessions.
 */
export class ProfileSessions {
	// Who is currently joining or joined, and which join attempt is the latest one.
	// A token (not just a flag) lets a quick leave-and-rejoin cancel the older, still loading attempt.
	private readonly joins = new Map<number, number>();
	private readonly active = new Map<number, ActiveSession>();
	private nextToken = 0;
	private loadedListeners: Array<(userId: number) => void> = [];

	/** Called each time a player's data becomes available. Lets other features push the initial state. */
	public onLoaded(listener: (userId: number) => void): void {
		this.loadedListeners.push(listener);
	}

	public constructor(
		private readonly backend: ProfileBackend,
		private readonly kick: (userId: number, message: string) => void,
		private readonly log: (message: string) => void,
	) {}

	/** Yields while the profile loads. Call it from its own thread. */
	public playerAdded(userId: number): void {
		if (this.joins.has(userId)) {
			return; // Duplicate event, a load is already running or finished.
		}
		this.nextToken += 1;
		const token = this.nextToken;
		this.joins.set(userId, token);
		const isCurrent = () => this.joins.get(userId) === token;

		const session = this.backend.startSession(profileKey(userId), () => !isCurrent());

		if (session === undefined) {
			if (isCurrent()) {
				this.log(`could not start a session for ${userId}`);
				this.kick(userId, MESSAGE_LOAD_FAILED);
			}
			return;
		}
		if (!isCurrent()) {
			// The player left (or rejoined) while we were waiting. Release the lock right away.
			session.end();
			return;
		}
		if (!session.isActive()) {
			this.log(`session for ${userId} ended while loading`);
			this.kick(userId, MESSAGE_SESSION_TAKEN);
			return;
		}

		const result = loadProfileData(session.getData());
		if (!result.ok) {
			// Do not touch the save. Releasing it unchanged keeps the original data safe for a fix.
			this.log(`refused data of ${userId}: ${result.reason} ${result.detail ?? ""}`);
			session.end();
			this.kick(userId, MESSAGE_DATA_PROBLEM);
			return;
		}
		if (result.repairs.size() > 0) {
			this.log(`repaired data of ${userId}: ${result.repairs.join(", ")}`);
		}

		session.replaceData(result.data);
		const entry: ActiveSession = { session, data: result.data };
		this.active.set(userId, entry);

		session.onSessionEnd(() => {
			// Fires on our own end() too. Only react if this session is still the registered one.
			if (this.active.get(userId) === entry) {
				this.active.delete(userId);
				this.log(`session of ${userId} was taken by another server`);
				this.kick(userId, MESSAGE_SESSION_TAKEN);
			}
		});

		for (const listener of this.loadedListeners) {
			// A broken listener must not stop the others or leave the player half loaded.
			const [ok, err] = pcall(listener, userId);
			if (!ok) {
				this.log(`loaded listener failed: ${err}`);
			}
		}
	}

	public playerRemoving(userId: number): void {
		this.joins.delete(userId);
		const entry = this.active.get(userId);
		if (entry !== undefined) {
			this.active.delete(userId);
			entry.session.end();
		}
	}

	/**
	 * The player's live data, or undefined while loading, after leaving, or if loading failed.
	 * Server code changes this table directly: it is the table that gets saved.
	 */
	public saveNow(userId: number, timeoutSeconds: number): boolean {
		const entry = this.active.get(userId);
		return entry !== undefined && entry.session.saveAndWait(timeoutSeconds);
	}

	public getData(userId: number): ProfileData | undefined {
		return this.active.get(userId)?.data;
	}
}
