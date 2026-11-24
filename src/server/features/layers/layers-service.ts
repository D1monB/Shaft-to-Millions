// Camps: touching a layer's camp opens that layer (one step at a time) and makes it the respawn point.
// Death in the mine is soft for now: the player respawns at the last touched opened camp and loses nothing.
//
// Camps are NOT Roblox spawn points (SpawnLocation.Enabled = false or a plain Part): Roblox would otherwise spawn
// new players at random camps, including locked deep ones. The server moves the character itself instead.
import { CollectionService, Players } from "@rbxts/services";
import { LAYERS } from "shared/config/layers";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { reachLayer, unlockCooldownLeft } from "shared/features/layers";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";
import { getInstancePosition } from "server/lib/proximity";

// Touched fires many times per second while standing on a part; this keeps the work small.
const touchLimiter = new RateLimiter(2, 1);
// When each player last opened a layer (or joined). Not saved: a rejoin restarts the wait, which is harmless.
const lastUnlockAt = new Map<Player, number>();
// One "wait N s" message per camp visit is enough.
const waitNoticeLimiter = new RateLimiter(1, 0.2);
// The camp each player respawns at. Not saved: after a rejoin the player starts on the surface.
const respawnCamp = new Map<Player, Instance>();

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
	const reached = reachLayer(data.deepestLayer, layer);
	if (reached !== undefined) {
		const wait = unlockCooldownLeft(os.clock(), lastUnlockAt.get(player) ?? 0);
		if (wait > 0) {
			if (waitNoticeLimiter.tryTake(player.UserId, os.clock())) {
				notify(player, `Табір ще не готовий: зачекай ${math.ceil(wait)} с і торкнись знову.`, "info");
			}
			return;
		}
		lastUnlockAt.set(player, os.clock());
		data.deepestLayer = reached;
		markDirty(player);
		notify(player, `Відкрито новий шар: ${LAYERS[reached]?.name ?? reached}!`, "success");
	}
	// Only an opened camp becomes the respawn point: a locked one would be a free teleport down.
	if (layer <= data.deepestLayer) {
		respawnCamp.set(player, camp);
	}
}

/** After a respawn, moves the new character to the player's camp (if they have one). */
function onCharacterAdded(player: Player, character: Model): void {
	const camp = respawnCamp.get(player);
	if (camp === undefined || !camp.IsDescendantOf(game.Workspace)) {
		return;
	}
	const position = getInstancePosition(camp);
	if (position === undefined) {
		return;
	}
	// Wait one frame so the default spawn finishes before we move the character.
	task.defer(() => {
		if (character.Parent !== undefined) {
			character.PivotTo(new CFrame(position.add(new Vector3(0, 4, 0))));
		}
	});
}

function setupCamp(camp: Instance): void {
	if (camp.IsA("SpawnLocation")) {
		camp.Enabled = false;
	}
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

function trackPlayer(player: Player): void {
	lastUnlockAt.set(player, os.clock());
	player.CharacterAdded.Connect((character) => onCharacterAdded(player, character));
}

export function startLayersService(): void {
	CollectionService.GetTagged(TAGS.CampSpawn).forEach(setupCamp);
	CollectionService.GetInstanceAddedSignal(TAGS.CampSpawn).Connect(setupCamp);
	Players.PlayerAdded.Connect(trackPlayer);
	Players.GetPlayers().forEach(trackPlayer);
	Players.PlayerRemoving.Connect((player) => {
		touchLimiter.forget(player.UserId);
		waitNoticeLimiter.forget(player.UserId);
		lastUnlockAt.delete(player);
		respawnCamp.delete(player);
	});
}
