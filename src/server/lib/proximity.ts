// Server-side "is the player really standing there" checks. Clients can lie about anything, so every
// request that needs the player to be at a place (shop, sell zone, machine) is checked here.
import { CollectionService } from "@rbxts/services";

/** The character's root position, or undefined if the player has no live character. */
export function getRootPosition(player: Player): Vector3 | undefined {
	const character = player.Character;
	const root = character?.FindFirstChild("HumanoidRootPart");
	const humanoid = character?.FindFirstChildOfClass("Humanoid");
	if (root === undefined || !root.IsA("BasePart") || humanoid === undefined || humanoid.Health <= 0) {
		return undefined;
	}
	return root.Position;
}

/** World position of a tagged object (Model pivot or Part position). */
export function getInstancePosition(instance: Instance): Vector3 | undefined {
	if (instance.IsA("BasePart")) {
		return instance.Position;
	}
	if (instance.IsA("Model")) {
		return instance.GetPivot().Position;
	}
	return undefined;
}

/**
 * Finds the nearest object with `tag` within `maxDistance` of the player, optionally filtered.
 * Returns undefined when nothing is close enough.
 */
export function findNearbyTagged(
	player: Player,
	tag: string,
	maxDistance: number,
	filter?: (instance: Instance) => boolean,
): Instance | undefined {
	const position = getRootPosition(player);
	if (position === undefined) {
		return undefined;
	}
	let best: Instance | undefined;
	let bestDistance = maxDistance;
	for (const instance of CollectionService.GetTagged(tag)) {
		if (!instance.IsDescendantOf(game.Workspace) || (filter !== undefined && !filter(instance))) {
			continue;
		}
		const target = getInstancePosition(instance);
		if (target === undefined) {
			continue;
		}
		const distance = target.sub(position).Magnitude;
		if (distance <= bestDistance) {
			best = instance;
			bestDistance = distance;
		}
	}
	return best;
}

/** Adds a ProximityPrompt to a tagged object so players on any device can interact with it. */
export function ensurePrompt(instance: Instance, actionText: string, objectText: string, distance = 10): void {
	const anchor = instance.IsA("Model")
		? (instance.PrimaryPart ?? instance.FindFirstChildWhichIsA("BasePart"))
		: instance;
	if (anchor === undefined || anchor.FindFirstChildOfClass("ProximityPrompt") !== undefined) {
		return;
	}
	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = actionText;
	prompt.ObjectText = objectText;
	prompt.MaxActivationDistance = distance;
	prompt.RequiresLineOfSight = false;
	prompt.HoldDuration = 0;
	prompt.Parent = anchor;
}
