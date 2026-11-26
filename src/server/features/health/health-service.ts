// Fall damage (decision 067). The server samples every character's height and checks the ground with its own ray.
// The client moves its own character, so a cheater could dodge this: it is a soft penalty, nothing of value depends
// on it. Server-carried rides and teleports are skipped by the reset on a big jump.
import { Players, Workspace } from "@rbxts/services";
import { FALL_SAMPLE_SECONDS, FallState, stepFall } from "shared/features/health";
import { text } from "shared/features/i18n";
import { notify } from "server/lib/notify";

const states = new Map<Player, FallState>();

function sample(player: Player): void {
	const character = player.Character;
	const humanoid = character?.FindFirstChildOfClass("Humanoid");
	const root = character?.FindFirstChild("HumanoidRootPart");
	if (humanoid === undefined || root === undefined || !root.IsA("BasePart") || humanoid.Health <= 0) {
		states.delete(player);
		return;
	}
	let state = states.get(player);
	if (state === undefined) {
		state = {};
		states.set(player, state);
	}
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = [character as Instance]; // humanoid exists, so the character does
	const reach = humanoid.HipHeight + root.Size.Y / 2 + 1.5;
	const grounded = Workspace.Raycast(root.Position, new Vector3(0, -reach, 0), params) !== undefined;
	const damage = stepFall(state, root.Position.Y, grounded);
	if (damage > 0) {
		humanoid.TakeDamage(damage);
		notify(player, text("health.fall", { damage }), "error");
	}
}

export function startHealthService(): void {
	Players.PlayerRemoving.Connect((player) => states.delete(player));
	task.spawn(() => {
		for (;;) {
			task.wait(FALL_SAMPLE_SECONDS);
			for (const player of Players.GetPlayers()) {
				const [ok, err] = pcall(sample, player);
				if (!ok) {
					warn(`[health] sample failed: ${err}`);
				}
			}
		}
	});
}
