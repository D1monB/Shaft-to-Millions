// Movement on the server: applies WalkSpeed from shoes (and later a speed aura) and checks that the character
// really moves that fast. The server owns WalkSpeed; the check pulls back a client that teleports or outruns it.
import { Players, RunService } from "@rbxts/services";
import {
	beginMoveState,
	beginSettle,
	checkMove,
	CHECK_INTERVAL,
	MoveState,
	PendingTeleport,
	settle,
	walkSpeedFor,
} from "shared/features/movement";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getLoadedPlayers, getProfileData } from "server/features/profile";

let speedBonusOf: (player: Player) => number = () => 0;

/** Last honest position per player. No entry means "start tracking from the next sample". */
const states = new Map<Player, MoveState>();

/** Server teleports the check is waiting to see arrive (see teleport-settle.ts). */
const pending = new Map<Player, PendingTeleport>();

/** Log at most a few pull-backs per player, so a cheater cannot flood the output. */
const logLimiter = new RateLimiter(2, 1 / 30);

const honestSampleListeners: Array<(player: Player, position: Vector3) => void> = [];

/**
 * Called with every position that passed the movement check. Lets the leaderboard record depth without trusting
 * raw positions: a teleport or speed hack sample never reaches the listeners.
 */
export function onHonestSample(listener: (player: Player, position: Vector3) => void): void {
	honestSampleListeners.push(listener);
}

let speedPenaltyOf: (player: Player) => number = () => 0;

/**
 * A short slow (cave-in, decision 065): applied to WalkSpeed only. The movement check keeps the normal speed, so an
 * honest player whose slow arrives late is never pulled back.
 */
export function setSpeedPenaltyProvider(provider: (player: Player) => number): void {
	speedPenaltyOf = provider;
}

/** Lets the equipment feature add a speed-aura bonus without movement depending on it. */
export function setSpeedBonusProvider(provider: (player: Player) => number): void {
	speedBonusOf = provider;
}

/**
 * The ONLY way server code should move a character (plot spawn, camp respawn, fast travel). It remembers where the
 * character was, moves it, and makes the movement check wait for the client to report the new spot.
 * Why: a bare PivotTo looks like a teleport to the check, and an honest player would be pulled back.
 * Does nothing if the character is not in the world.
 */
export function teleportCharacter(player: Player, target: Vector3): void {
	const character = player.Character;
	if (character === undefined || character.Parent === undefined) {
		return;
	}
	const from = character.GetPivot().Position;
	character.PivotTo(new CFrame(target));
	states.delete(player);
	const settling = beginSettle(
		{ x: from.X, y: from.Y, z: from.Z },
		{ x: target.X, y: target.Y, z: target.Z },
		os.clock(),
	);
	if (settling !== undefined) {
		pending.set(player, settling);
	} else {
		pending.delete(player);
	}
}

/** Players the server itself is carrying (a lift ride): not checked, the server moves them. */
const held = new Set<Player>();

/**
 * Starts or ends a server-carried ride (the lift). While held the character is not checked. End it with `false`
 * BEFORE the final teleportCharacter, so the check waits for the client at the ride's end like after any teleport.
 */
export function holdCharacter(player: Player, hold: boolean): void {
	if (hold) {
		held.add(player);
	} else {
		held.delete(player);
	}
	states.delete(player);
	pending.delete(player);
}

/** Moves the character to a spot keeping where it faces, and stops any speed the client built up. */
function putAt(character: Model, root: BasePart, position: Vector3): void {
	const pivot = character.GetPivot();
	character.PivotTo(pivot.sub(pivot.Position).add(position));
	root.AssemblyLinearVelocity = Vector3.zero;
}

function walkSpeedOf(player: Player): number | undefined {
	const data = getProfileData(player);
	return data === undefined ? undefined : walkSpeedFor(data.gear.equipped.shoes, speedBonusOf(player));
}

function applySpeed(player: Player): void {
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	const speed = walkSpeedOf(player);
	if (humanoid === undefined || speed === undefined) {
		return;
	}
	const target = speed * (1 - math.clamp(speedPenaltyOf(player), 0, 1));
	if (humanoid.WalkSpeed !== target) {
		humanoid.WalkSpeed = target;
	}
}

function checkPosition(player: Player): void {
	const character = player.Character;
	const humanoid = character?.FindFirstChildOfClass("Humanoid");
	const root = character?.FindFirstChild("HumanoidRootPart");
	const walkSpeed = walkSpeedOf(player);
	// Character or profile not loaded yet: start over once they are.
	if (
		character === undefined ||
		humanoid === undefined ||
		root === undefined ||
		!root.IsA("BasePart") ||
		walkSpeed === undefined
	) {
		states.delete(player);
		return;
	}
	// A dead body is only skipped, the baseline stays: dying must not hand out a free unchecked start.
	// There is NO exemption for Humanoid.Sit: the client controls its own character, so "I am seated" proves nothing,
	// and the game has no vehicles. If seats or vehicles come, trust only a server-known Seat (humanoid.SeatPart).
	if (humanoid.Health <= 0) {
		return;
	}
	if (held.has(player)) {
		states.delete(player);
		return;
	}

	const position = root.Position;
	const sample = { x: position.X, y: position.Y, z: position.Z, time: os.clock() };

	// Right after a server teleport: wait for the client to report the new spot, then start over from there.
	const settling = pending.get(player);
	if (settling !== undefined) {
		const verdict = settle(settling, sample, sample.time, walkSpeed);
		if (verdict === "wait") {
			return;
		}
		pending.delete(player);
		if (verdict === "timeout") {
			const target = new Vector3(settling.target.x, settling.target.y, settling.target.z);
			// Studio only warns, like the speed check (decision 028): Studio tools may move the character.
			if (!RunService.IsStudio()) {
				putAt(character, root, target);
			}
			states.set(player, { x: target.X, y: target.Y, z: target.Z, time: sample.time, strikes: 0 });
			if (logLimiter.tryTake(player.UserId, os.clock())) {
				warn(`[movement] user ${player.UserId} left the path of a server teleport, put at its target`);
			}
			return;
		}
		states.delete(player);
	}
	const state = states.get(player);
	if (state === undefined) {
		const started = beginMoveState(sample);
		if (started !== undefined) {
			states.set(player, started);
		}
		return;
	}

	const result = checkMove(state, sample, walkSpeed);
	states.set(player, result.state);
	if (result.verdict === "ok") {
		for (const listener of honestSampleListeners) {
			listener(player, position);
		}
	}
	if (result.verdict !== "rubberband") {
		return;
	}
	// In Studio only warn: the developer moves and scales characters with Studio tools while testing, and a pull-back
	// would fight them. Live servers always pull back.
	if (RunService.IsStudio()) {
		if (logLimiter.tryTake(player.UserId, os.clock())) {
			warn(`[movement] user ${player.UserId} moved faster than allowed (Studio: not pulled back)`);
		}
		states.set(player, { x: position.X, y: position.Y, z: position.Z, time: sample.time, strikes: 0 });
		return;
	}
	// Move back to the last honest spot.
	putAt(character, root, new Vector3(result.state.x, result.state.y, result.state.z));
	if (logLimiter.tryTake(player.UserId, os.clock())) {
		warn(`[movement] user ${player.UserId} pulled back (moved faster than allowed)`);
	}
}

function forget(player: Player): void {
	states.delete(player);
	pending.delete(player);
	held.delete(player);
	logLimiter.forget(player.UserId);
}

export function startMovementService(): void {
	// A new character starts a new baseline: the spawn point is far from where the old one died.
	// A respawn is not a server teleport: drop any wait too, the new body starts its own baseline.
	const track = (player: Player) =>
		player.CharacterAdded.Connect(() => {
			states.delete(player);
			pending.delete(player);
		});
	Players.PlayerAdded.Connect(track);
	Players.GetPlayers().forEach(track);
	Players.PlayerRemoving.Connect(forget);

	// A cheap periodic pass instead of wiring every purchase and equip: changes show up within half a second,
	// and a new character (respawn) gets its speed without extra events.
	task.spawn(() => {
		for (;;) {
			task.wait(0.5);
			for (const player of getLoadedPlayers()) {
				pcall(applySpeed, player);
			}
		}
	});

	task.spawn(() => {
		for (;;) {
			task.wait(CHECK_INTERVAL);
			for (const player of getLoadedPlayers()) {
				// pcall so one broken character does not stop the check for everyone.
				pcall(checkPosition, player);
			}
		}
	});
}
