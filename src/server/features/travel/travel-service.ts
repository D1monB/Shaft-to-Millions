// Fast travel: the player picks the surface or an opened camp, the SERVER checks everything and moves the character.
// The client only sends the destination number. Going up is free; a pause between trips keeps the descent meaningful.
import { CollectionService, Players } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { SURFACE, TRAVEL_REMOTE, canTravelTo, isTravelDestination, travelCooldownLeft } from "shared/features/travel";
import { RateLimiter } from "shared/lib/rate-limiter";
import { resetMovementBaseline } from "server/features/movement";
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
		notify(player, `Подорож ще не готова: зачекай ${math.ceil(wait)} с.`, "info");
		return;
	}
	const point = findDestinationPoint(destination);
	const position = point === undefined ? undefined : getInstancePosition(point);
	if (position === undefined) {
		notify(player, "Це місце ще не готове на карті.", "error");
		return;
	}

	// Start the pause only after a successful trip, so a missing map point never costs the player 30 s.
	lastTravelAt.set(player, os.clock());
	const target = position.add(new Vector3(0, 4, 0));
	character.PivotTo(new CFrame(target));
	// Our own move must not look like a teleport to the movement check.
	resetMovementBaseline(player, target);
}

export function startTravelService(): void {
	onClientRequest(TRAVEL_REMOTE, limiter, handleTravel);
	Players.PlayerRemoving.Connect((player) => lastTravelAt.delete(player));
}
