// Fast travel: the player picks their base, the surface or an opened camp, the SERVER checks everything and moves the character.
// The client only sends the destination number. Going up is free; a pause between trips keeps the descent meaningful.
import { text } from "shared/features/i18n";
import { CollectionService, Players } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { HOME, SURFACE, TRAVEL_REMOTE, canTravelTo, isTravelDestination, travelCooldownLeft } from "shared/features/travel";
import { RateLimiter } from "shared/lib/rate-limiter";
import { homePositionOf } from "server/features/line";
import { teleportCharacter } from "server/features/movement";
import { getProfileData } from "server/features/profile";
import { notify } from "server/lib/notify";
import { getInstancePosition, getRootPosition } from "server/lib/proximity";
import { logAbuse, onClientRequest } from "server/lib/remotes";

const limiter = new RateLimiter(2, 0.5);
/** When each player last travelled. Not saved: a rejoin gives one free trip, which is harmless. */
const lastTravelAt = new Map<Player, number>();

/** The map object a destination leads to: the SurfaceSpawn, or the CampSpawn of that layer. */
function findDestinationPoint(destination: number): Instance | undefined {
	const tag = destination === SURFACE ? TAGS.SurfaceSpawn : TAGS.CampSpawn;
	for (const instance of CollectionService.GetTagged(tag)) {
		if (!instance.IsDescendantOf(game.Workspace)) {
			continue;
		}
		if (destination === SURFACE || instance.GetAttribute(ATTRIBUTES.LayerId) === destination) {
			return instance;
		}
	}
	return undefined;
}

/** Where a destination leads: the player's own plot for HOME, otherwise a tagged map point. */
function destinationPosition(player: Player, destination: number): Vector3 | undefined {
	if (destination === HOME) {
		return homePositionOf(player);
	}
	const point = findDestinationPoint(destination);
	return point === undefined ? undefined : getInstancePosition(point);
}

function handleTravel(player: Player, args: Array<unknown>): void {
	const [destination] = args;
	if (args.size() !== 1 || !isTravelDestination(destination)) {
		logAbuse(player, "bad TravelTo arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	if (!canTravelTo(destination, data.deepestLayer)) {
		logAbuse(player, "TravelTo a camp that is not opened");
		return;
	}
	// A dead or missing character cannot travel; the respawn already puts it at a camp.
	const character = player.Character;
	if (character === undefined || getRootPosition(player) === undefined) {
		return;
	}
	const wait = travelCooldownLeft(os.clock(), lastTravelAt.get(player));
	if (wait > 0) {
		notify(player, text("travel.notReady", { seconds: math.ceil(wait) }), "info");
		return;
	}
	const position = destinationPosition(player, destination);
	if (position === undefined) {
		notify(player, text(destination === HOME ? "travel.noBase" : "travel.placeMissing"), "error");
		return;
	}

	// Start the pause only after a successful trip, so a missing map point never costs the player 30 s.
	lastTravelAt.set(player, os.clock());
	// Through movement, so our own move does not look like a teleport to the check.
	teleportCharacter(player, position.add(new Vector3(0, 4, 0)));
}

export function startTravelService(): void {
	onClientRequest(TRAVEL_REMOTE, limiter, handleTravel);
	Players.PlayerRemoving.Connect((player) => lastTravelAt.delete(player));
}
