// Applies WalkSpeed from shoes (and later a speed aura). The server owns WalkSpeed: a client changing it
// locally is a cheat that a later speed check will catch, but the honest value always comes from here.
import { walkSpeedFor } from "shared/features/movement";
import { getLoadedPlayers, getProfileData } from "server/features/profile";

let speedBonusOf: (player: Player) => number = () => 0;

/** Lets the equipment feature add a speed-aura bonus without movement depending on it. */
export function setSpeedBonusProvider(provider: (player: Player) => number): void {
	speedBonusOf = provider;
}

function apply(player: Player): void {
	const data = getProfileData(player);
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	if (data === undefined || humanoid === undefined) {
		return;
	}
	const target = walkSpeedFor(data.levels.shoes, speedBonusOf(player));
	if (humanoid.WalkSpeed !== target) {
		humanoid.WalkSpeed = target;
	}
}

export function startMovementService(): void {
	// A cheap periodic pass instead of wiring every purchase and equip: changes show up within half a second,
	// and a new character (respawn) gets its speed without extra events.
	task.spawn(() => {
		for (;;) {
			task.wait(0.5);
			for (const player of getLoadedPlayers()) {
				pcall(apply, player);
			}
		}
	});
}
