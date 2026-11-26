// Camps: touching a layer's camp opens that layer (one step at a time) and makes it the respawn point.
// Death in the mine is soft for now: the player respawns at the last touched opened camp and loses nothing.
//
// Camps are NOT Roblox spawn points (SpawnLocation.Enabled = false or a plain Part): Roblox would otherwise spawn
// new players at random camps, including locked deep ones. The server moves the character itself instead.
import { CollectionService, Players, Workspace } from "@rbxts/services";
import { nameKeys, ref, text } from "shared/features/i18n";
import { ATTRIBUTES, ORE_SPAWNS, PLOTS, TAGS } from "shared/config/map-contract";
import { LAYER_ZONE_RADIUS, reachLayer, unlockCooldownLeft } from "shared/features/layers";
import { tierOf } from "shared/features/mining";
import { ProfileData } from "shared/features/profile";
import { RateLimiter } from "shared/lib/rate-limiter";
import { onHonestSample, teleportCharacter } from "server/features/movement";
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

/** Opens `layer` if it is the next one and the unlock pause is over. */
function tryOpen(player: Player, data: ProfileData, layer: number): void {
	const reached = reachLayer(data.deepestLayer, layer);
	if (reached === undefined) {
		return;
	}
	const wait = unlockCooldownLeft(os.clock(), lastUnlockAt.get(player) ?? 0);
	if (wait > 0) {
		if (waitNoticeLimiter.tryTake(player.UserId, os.clock())) {
			notify(player, text("layers.campNotReady", { seconds: math.ceil(wait) }), "info");
		}
		return;
	}
	lastUnlockAt.set(player, os.clock());
	data.deepestLayer = reached;
	markDirty(player);
	notify(player, text("layers.opened", { layer: ref(nameKeys.layer(reached)) }), "success");
}

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
	tryOpen(player, data, layer);
	// Only an opened camp becomes the respawn point: a locked one would be a free teleport down.
	if (layer <= data.deepestLayer) {
		respawnCamp.set(player, camp);
	}
}

/** True when the player has an opened camp to respawn at (then the camp, not the plot, is their spawn). */
export function hasRespawnCamp(player: Player): boolean {
	const camp = respawnCamp.get(player);
	return camp !== undefined && camp.IsDescendantOf(game.Workspace);
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
			// Through movement, so our own move does not look like a teleport to the check.
			teleportCharacter(player, position.add(new Vector3(0, 4, 0)));
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

/**
 * The map author's open pit has no camps (decision 041): a layer opens when the player walks up to its ore. Spawn
 * points of each layer (Map/Mine/OreSpawns/Tier<N>) are read once. Only honest positions count (they passed the
 * movement check), so a teleport cannot open a layer.
 */
function readLayerZones(): Map<number, Vector3[]> {
	const zones = new Map<number, Vector3[]>();
	const spawns = Workspace.FindFirstChild(PLOTS.MapFolder)
		?.FindFirstChild(ORE_SPAWNS.Mine)
		?.FindFirstChild(ORE_SPAWNS.Spawns);
	for (const folder of spawns?.GetChildren() ?? []) {
		const tier = tierOf(folder.Name);
		if (tier === undefined) {
			continue;
		}
		const points = folder
			.GetChildren()
			.filter((child): child is BasePart => child.IsA("BasePart"))
			.map((part) => part.Position);
		zones.set(tier, points);
	}
	return zones;
}

function onHonestPosition(zones: Map<number, Vector3[]>, player: Player, position: Vector3): void {
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	// One step at a time: only the next layer is checked.
	const points = zones.get(data.deepestLayer + 1);
	if (points?.some((point) => point.sub(position).Magnitude <= LAYER_ZONE_RADIUS) === true) {
		tryOpen(player, data, data.deepestLayer + 1);
	}
}

function trackPlayer(player: Player): void {
	lastUnlockAt.set(player, os.clock());
	player.CharacterAdded.Connect((character) => onCharacterAdded(player, character));
}

export function startLayersService(): void {
	CollectionService.GetTagged(TAGS.CampSpawn).forEach(setupCamp);
	CollectionService.GetInstanceAddedSignal(TAGS.CampSpawn).Connect(setupCamp);
	const zones = readLayerZones();
	onHonestSample((player, position) => onHonestPosition(zones, player, position));
	Players.PlayerAdded.Connect(trackPlayer);
	Players.GetPlayers().forEach(trackPlayer);
	Players.PlayerRemoving.Connect((player) => {
		touchLimiter.forget(player.UserId);
		waitNoticeLimiter.forget(player.UserId);
		lastUnlockAt.delete(player);
		respawnCamp.delete(player);
	});
}
