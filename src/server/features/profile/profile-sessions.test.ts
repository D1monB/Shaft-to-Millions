import { Assert, Test } from "@rbxts/lunit";
import { ProfileData, createDefaultProfileData } from "shared/features/profile";
import { ProfileBackend, ProfileSession } from "./ports";
import { ProfileSessions, profileKey } from "./profile-sessions";

const USER = 1001;

class FakeSession implements ProfileSession {
	public active = true;
	public endCalls = 0;
	public replaced: ProfileData | undefined;
	private endListeners: Array<() => void> = [];

	public constructor(public raw: unknown) {}

	public readonly isActive = () => this.active;
	public readonly getData = () => this.raw;
	public readonly replaceData = (data: ProfileData) => {
		this.replaced = data;
	};
	public readonly end = () => {
		this.endCalls += 1;
		this.active = false;
		// Like ProfileStore, ending our own session also fires OnSessionEnd.
		this.fireSessionEnd();
	};
	public readonly onSessionEnd = (callback: () => void) => {
		this.endListeners.push(callback);
	};

	/** Simulates another server taking the profile. */
	public fireSessionEnd() {
		this.active = false;
		for (const listener of this.endListeners) {
			listener();
		}
	}
}

class Harness {
	public readonly kicks: Array<[number, string]> = [];
	public readonly logs: string[] = [];
	public readonly started: FakeSession[] = [];
	public startCalls = 0;
	public keysSeen: string[] = [];
	/** Called inside startSession, i.e. while the player is still "loading". */
	public duringLoad: (() => void) | undefined;
	public nextRaw: unknown = createDefaultProfileData();
	public failToStart = false;
	/** Worst case: the lock was already acquired at the moment the load got cancelled. */
	public lockAcquiredEvenIfCancelled = false;

	public readonly backend: ProfileBackend = {
		startSession: (key, shouldCancel) => {
			this.startCalls += 1;
			this.keysSeen.push(key);
			const hook = this.duringLoad;
			this.duringLoad = undefined;
			if (hook !== undefined) {
				hook();
			}
			if (this.failToStart || (shouldCancel() && !this.lockAcquiredEvenIfCancelled)) {
				return undefined;
			}
			const session = new FakeSession(this.nextRaw);
			this.started.push(session);
			return session;
		},
	};

	public readonly sessions = new ProfileSessions(
		this.backend,
		(userId, message) => this.kicks.push([userId, message]),
		(message) => this.logs.push(message),
	);
}

class ProfileSessionsTests {
	@Test
	public loadsANewPlayer() {
		const h = new Harness();
		h.sessions.playerAdded(USER);
		const data = h.sessions.getData(USER);
		Assert.notUndefined(data);
		Assert.equal(data?.money, 0);
		Assert.equal(h.kicks.size(), 0);
		Assert.equal(h.keysSeen[0], profileKey(USER));
	}

	@Test
	public notifiesListenersOnlyWhenDataIsReady() {
		const h = new Harness();
		const seen: number[] = [];
		h.sessions.onLoaded((userId) => {
			// The data must already be available inside the callback.
			Assert.notUndefined(h.sessions.getData(userId));
			seen.push(userId);
		});
		h.sessions.playerAdded(USER);
		Assert.equal(seen.size(), 1);
		Assert.equal(seen[0], USER);
	}

	@Test
	public noListenerCallWhenLoadingFails() {
		const h = new Harness();
		let calls = 0;
		h.sessions.onLoaded(() => (calls += 1));
		h.failToStart = true;
		h.sessions.playerAdded(USER);
		Assert.equal(calls, 0);
	}

	@Test
	public brokenListenerDoesNotBreakLoading() {
		const h = new Harness();
		h.sessions.onLoaded(() => error("boom"));
		h.sessions.playerAdded(USER);
		Assert.notUndefined(h.sessions.getData(USER));
		Assert.equal(h.kicks.size(), 0);
	}

	@Test
	public handsOutTheSameTableThatWillBeSaved() {
		const h = new Harness();
		h.sessions.playerAdded(USER);
		// If these were different tables, server changes would never be saved.
		Assert.true(h.sessions.getData(USER) === h.started[0].replaced);
	}

	@Test
	public repairsDamagedDataAndLogsIt() {
		const h = new Harness();
		h.nextRaw = { ...createDefaultProfileData(), money: -5 };
		h.sessions.playerAdded(USER);

		Assert.equal(h.sessions.getData(USER)?.money, 0);
		Assert.equal(h.logs.size(), 1);
		Assert.equal(h.kicks.size(), 0);
	}

	@Test
	public kicksWhenTheSessionCannotStart() {
		const h = new Harness();
		h.failToStart = true;
		h.sessions.playerAdded(USER);
		Assert.equal(h.kicks.size(), 1);
		Assert.equal(h.kicks[0][0], USER);
		Assert.undefined(h.sessions.getData(USER));
	}

	@Test
	public refusesDataFromANewerVersionAndLeavesItUntouched() {
		const h = new Harness();
		const raw = { ...createDefaultProfileData(), schemaVersion: 99, brandNewFeature: "x" };
		h.nextRaw = raw;
		h.sessions.playerAdded(USER);
		const session = h.started[0];
		Assert.equal(h.kicks.size(), 1);
		Assert.equal(session.endCalls, 1);
		Assert.undefined(session.replaced);
		Assert.equal(raw.schemaVersion, 99);
		Assert.equal(raw.brandNewFeature, "x");
		Assert.undefined(h.sessions.getData(USER));
	}

	@Test
	public refusesUnreadableData() {
		const h = new Harness();
		h.nextRaw = 12345;
		h.sessions.playerAdded(USER);
		Assert.equal(h.kicks.size(), 1);
		Assert.equal(h.started[0].endCalls, 1);
	}

	@Test
	public releasesTheLockWhenThePlayerLeavesWhileLoading() {
		const h = new Harness();
		h.lockAcquiredEvenIfCancelled = true;
		h.duringLoad = () => {
			h.sessions.playerRemoving(USER);
		};
		h.sessions.playerAdded(USER);
		Assert.equal(h.started.size(), 1);
		Assert.equal(h.started[0].endCalls, 1);
		Assert.undefined(h.sessions.getData(USER));
		Assert.equal(h.kicks.size(), 0);
	}

	@Test
	public cancelsTheLoadWhenThePlayerLeaves() {
		const h = new Harness();
		h.duringLoad = () => {
			h.sessions.playerRemoving(USER);
		};
		h.sessions.playerAdded(USER);
		Assert.undefined(h.sessions.getData(USER));
		// The player is gone, so kicking them would be pointless noise.
		Assert.equal(h.kicks.size(), 0);
	}

	@Test
	public ignoresADuplicateJoinEvent() {
		const h = new Harness();
		h.sessions.playerAdded(USER);
		h.sessions.playerAdded(USER);
		Assert.equal(h.startCalls, 1);
	}

	@Test
	public rejoinDuringALoadCancelsTheOldAttempt() {
		const h = new Harness();
		h.lockAcquiredEvenIfCancelled = true;
		// While the first attempt is loading, the player leaves and joins again.
		h.duringLoad = () => {
			h.sessions.playerRemoving(USER);
			h.sessions.playerAdded(USER);
		};
		h.sessions.playerAdded(USER);
		// Two sessions were opened, but only the newest one may stay alive and be handed out.
		Assert.equal(h.started.size(), 2);
		Assert.equal(h.started.filter((s) => s.active).size(), 1);
		// The nested (second) join finishes first, so it is started[0]; the stale first attempt is started[1].
		Assert.true(h.sessions.getData(USER) === h.started[0].replaced);
		Assert.true(h.started[0].active);
		Assert.undefined(h.started[1].replaced);
		Assert.equal(h.started[1].endCalls, 1);
		Assert.equal(h.kicks.size(), 0);
	}

	@Test
	public endsTheSessionExactlyOnceWhenThePlayerLeaves() {
		const h = new Harness();
		h.sessions.playerAdded(USER);
		h.sessions.playerRemoving(USER);
		h.sessions.playerRemoving(USER);
		Assert.equal(h.started[0].endCalls, 1);
		Assert.undefined(h.sessions.getData(USER));
	}

	@Test
	public doesNotKickWhenOurOwnEndFiresTheSessionEndSignal() {
		const h = new Harness();
		h.sessions.playerAdded(USER);
		h.sessions.playerRemoving(USER);
		Assert.equal(h.kicks.size(), 0);
	}

	@Test
	public kicksWhenAnotherServerTakesTheProfile() {
		const h = new Harness();
		h.sessions.playerAdded(USER);
		h.started[0].fireSessionEnd();
		Assert.equal(h.kicks.size(), 1);
		Assert.undefined(h.sessions.getData(USER));
	}

	@Test
	public kicksOnlyOnceEvenIfTheSignalFiresTwice() {
		const h = new Harness();
		h.sessions.playerAdded(USER);
		h.started[0].fireSessionEnd();
		h.started[0].fireSessionEnd();
		Assert.equal(h.kicks.size(), 1);
	}

	@Test
	public keepsPlayersSeparate() {
		const h = new Harness();
		h.sessions.playerAdded(1);
		h.sessions.playerAdded(2);
		Assert.true(h.sessions.getData(1) !== h.sessions.getData(2));
		h.sessions.playerRemoving(1);
		Assert.undefined(h.sessions.getData(1));
		Assert.notUndefined(h.sessions.getData(2));
	}
}

export = ProfileSessionsTests;
