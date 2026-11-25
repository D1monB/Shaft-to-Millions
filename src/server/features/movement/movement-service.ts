// Movement on the server: applies WalkSpeed from shoes (and later a speed aura) and checks that the character
// really moves that fast. The server owns WalkSpeed; the check pulls back a client that teleports or outruns it.
import { Players, RunService } from "@rbxts/services";
import { beginMoveState, checkMove, CHECK_INTERVAL, MoveState, walkSpeedFor } from "shared/features/movement";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getLoadedPlayers, getProfileData } from "server/features/profile";

let speedBonusOf: (player: Player) => number = () => 0;

/** Last honest position per player. No entry means "start tracking from the next sample". */
const states = new Map<Player, MoveState>();

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

/** Lets the equipment feature add a speed-aura bonus without movement depending on it. */
export function setSpeedBonusProvider(provider: (player: Player) => number): void {
	speedBonusOf = provider;
}

/**
 * Call right AFTER the server itself moves a character (camp respawn, later elevator or fast travel).
 * Why: otherwise the jump looks like a teleport and an honest player would be pulled back.
 */
export function resetMovementBaseline(player: Player): void {
	states.delete(player);
}

function walkSpeedOf(player: Player): number | undefined {
	const data = getProfileData(player);
	return data === undefined ? undefined : walkSpeedFor(data.gear.equipped.shoes, speedBonusOf(player));
}

function applySpeed(player: Player): void {
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	const target = walkSpeedOf(player);
	if (humanoid === undefined || target === undefined) {
		return;
	}
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

	const position = root.Position;
	const sample = { x: position.X, y: position.Y, z: position.Z, time: os.clock() };
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
	// Move back to the last honest spot (keeping where the player faces) and stop any speed the client built up.
	const back = new Vector3(result.state.x, result.state.y, result.state.z);
	const pivot = character.GetPivot();
	character.PivotTo(pivot.sub(pivot.Position).add(back));
	root.AssemblyLinearVelocity = Vector3.zero;
	if (logLimiter.tryTake(player.UserId, os.clock())) {
		warn(`[movement] user ${player.UserId} pulled back (moved faster than allowed)`);
	}
}

function forget(player: Player): void {
	states.delete(player);
	logLimiter.forget(player.UserId);
}

export function startMovementService(): void {
	// A new character starts a new baseline: the spawn point is far from where the old one died.
	const track = (player: Player) => player.CharacterAdded.Connect(() => states.delete(player));
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
