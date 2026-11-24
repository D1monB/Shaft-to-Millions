// Movement on the server: applies WalkSpeed from shoes (and later a speed aura) and checks that the character
// really moves that fast. The server owns WalkSpeed; the check pulls back a client that teleports or outruns it.
import { Players } from "@rbxts/services";
import { beginMoveState, checkMove, CHECK_INTERVAL, MoveState, walkSpeedFor } from "shared/features/movement";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getLoadedPlayers, getProfileData } from "server/features/profile";

let speedBonusOf: (player: Player) => number = () => 0;

/** Last honest position per player. No entry means "start tracking from the next sample". */
const states = new Map<Player, MoveState>();

/** Log at most a few pull-backs per player, so a cheater cannot flood the output. */
const logLimiter = new RateLimiter(2, 1 / 30);

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
	return data === undefined ? undefined : walkSpeedFor(data.levels.shoes, speedBonusOf(player));
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
	// Dead, seated (vehicles move the character on their own) or not loaded: no honest baseline to compare to.
	if (
		character === undefined ||
		humanoid === undefined ||
		humanoid.Health <= 0 ||
		humanoid.Sit ||
		root === undefined ||
		!root.IsA("BasePart") ||
		walkSpeed === undefined
	) {
		states.delete(player);
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
	if (result.verdict !== "rubberband") {
		return;
	}
	// Move back to the last honest spot and stop any speed the client built up.
	character.PivotTo(new CFrame(new Vector3(result.state.x, result.state.y, result.state.z)));
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
