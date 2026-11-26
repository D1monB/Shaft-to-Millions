// The spark burst on the map author's chest terminal when this player's roll comes out. Local effect only: other
// players do not see it. The terminals' moving parts are animated by the map author's MachineAnimator script, not here.
import { CollectionService, Players } from "@rbxts/services";
import { ChestId } from "shared/config/chests";
import { ATTRIBUTES, CHEST_TERMINALS, TAGS } from "shared/config/map-contract";
import { CHEST_DISTANCE } from "shared/features/chests";

/** Used when the emitter has no EmitCount attribute. */
const DEFAULT_EMIT_COUNT = 60;

/**
 * Bursts the terminal the player stands at. Does nothing away from every terminal of this chest, for example when a
 * Robux receipt is processed later.
 */
export function playTerminalBurst(chestId: ChestId): void {
	const position = Players.LocalPlayer.Character?.GetPivot().Position;
	if (position === undefined) {
		return;
	}
	let nearest: Instance | undefined;
	let nearestDistance = CHEST_DISTANCE;
	for (const stand of CollectionService.GetTagged(TAGS.Chest)) {
		if (stand.IsA("BasePart") && stand.GetAttribute(ATTRIBUTES.ChestId) === chestId) {
			const distance = stand.Position.sub(position).Magnitude;
			if (distance <= nearestDistance) {
				nearest = stand;
				nearestDistance = distance;
			}
		}
	}
	const burst = nearest?.Parent?.FindFirstChild(CHEST_TERMINALS.Burst, true);
	if (burst !== undefined && burst.IsA("ParticleEmitter")) {
		const count = burst.GetAttribute("EmitCount");
		burst.Emit(typeIs(count, "number") ? count : DEFAULT_EMIT_COUNT);
	}
}
