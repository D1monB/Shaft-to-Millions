// Camps: touching a layer's camp opens that layer (one step at a time) and makes it the respawn point.
// Death in the mine is soft for now: the player respawns at the last camp and loses nothing.
import { CollectionService, Players } from "@rbxts/services";
import { LAYERS } from "shared/config/layers";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { reachLayer } from "shared/features/layers";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";

// Touched fires many times per second while standing on a part; this keeps the work small.
const touchLimiter = new RateLimiter(2, 1);

function onCampTouched(camp: Instance, hit: BasePart): void {
	const character = hit.FindFirstAncestorOfClass("Model");
	const player = character === undefined ? undefined : Players.GetPlayerFromCharacter(character);
	if (player === undefined || !touchLimiter.tryTake(player.UserId, os.clock())) {
		return;
	}
	const data = getProfileData(player);
	const layer = camp.GetAttribute(ATTRIBUTES.LayerId);
	if (data === undefined || !typeIs(layer, "number")) {
		return;
	}
	if (camp.IsA("SpawnLocation") && layer <= data.deepestLayer + 1) {
		player.RespawnLocation = camp;
	}
	const reached = reachLayer(data.deepestLayer, layer);
	if (reached !== undefined) {
		data.deepestLayer = reached;
		markDirty(player);
		notify(player, `Відкрито новий шар: ${LAYERS[reached]?.name ?? reached}!`, "success");
	}
}

function setupCamp(camp: Instance): void {
	const parts: BasePart[] = camp.IsA("BasePart") ? [camp] : [];
	for (const descendant of camp.GetDescendants()) {
		if (descendant.IsA("BasePart")) {
			parts.push(descendant);
		}
	}
	for (const part of parts) {
		part.Touched.Connect((hit) => onCampTouched(camp, hit));
	}
}

export function startLayersService(): void {
	CollectionService.GetTagged(TAGS.CampSpawn).forEach(setupCamp);
	CollectionService.GetInstanceAddedSignal(TAGS.CampSpawn).Connect(setupCamp);
	Players.PlayerRemoving.Connect((player) => touchLimiter.forget(player.UserId));
}
