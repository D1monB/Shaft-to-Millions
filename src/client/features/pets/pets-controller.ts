// Draws the pets of every player and moves them smoothly after their owner. Effects only: the server publishes WHICH
// pets are equipped (a Player attribute) and never moves anything. The parts are plain client-side objects taken from a
// pool, so equipping, leaving or walking away never creates garbage, and far-away players cost nothing.
import { Players, RunService, Workspace } from "@rbxts/services";
import { ITEMS, ItemId, RARITY_COLORS } from "shared/config/items";
import { PETS_ATTRIBUTE, decodePets, followAlpha, petOffset } from "shared/features/equipment";

/** How fast a pet catches up with its target (higher = stiffer). */
const FOLLOW_RATE = 8;
/** If a pet is farther than this from its target (a teleport or respawn), it jumps instead of flying across the map. */
const SNAP_DISTANCE = 40;
/** Players farther than this from the camera get no pets drawn: invisible anyway, and it saves mobile devices work. */
const RENDER_DISTANCE = 120;
const PET_SIZE = 1.2;
const FOLDER_NAME = "ClientPets";

interface PetRig {
	readonly part: Part;
	itemId: ItemId | undefined;
	position: Vector3;
}

const rigsByPlayer = new Map<Player, PetRig[]>();
/** Parts waiting to be reused. */
const pool: Part[] = [];
let folder: Folder | undefined;

function getFolder(): Folder {
	if (folder === undefined || folder.Parent === undefined) {
		const created = new Instance("Folder");
		created.Name = FOLDER_NAME;
		created.Parent = Workspace;
		folder = created;
	}
	return folder;
}

function acquirePart(): Part {
	const reused = pool.pop();
	const part = reused ?? new Instance("Part");
	if (reused === undefined) {
		part.Shape = Enum.PartType.Ball;
		part.Size = new Vector3(PET_SIZE, PET_SIZE, PET_SIZE);
		part.Material = Enum.Material.Neon;
		part.Anchored = true;
		part.CanCollide = false;
		part.CanQuery = false;
		part.CanTouch = false;
		part.CastShadow = false;
	}
	part.Parent = getFolder();
	return part;
}

function releaseRig(rig: PetRig): void {
	rig.part.Parent = undefined;
	rig.itemId = undefined;
	pool.push(rig.part);
}

function releaseAll(player: Player): void {
	const rigs = rigsByPlayer.get(player);
	if (rigs === undefined) {
		return;
	}
	for (const rig of rigs) {
		releaseRig(rig);
	}
	rigsByPlayer.delete(player);
}

/** Colour and name by item, only when a rig changes its pet (not every frame). */
function style(rig: PetRig, itemId: ItemId): void {
	const color = RARITY_COLORS[ITEMS[itemId].rarity];
	rig.part.Color = Color3.fromRGB(color[0], color[1], color[2]);
	rig.part.Name = itemId;
	rig.itemId = itemId;
}

function updatePlayer(player: Player, alpha: number, time: number, cameraPosition: Vector3 | undefined): void {
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	if (root === undefined || !root.IsA("BasePart")) {
		releaseAll(player);
		return;
	}
	if (cameraPosition !== undefined && root.Position.sub(cameraPosition).Magnitude > RENDER_DISTANCE) {
		releaseAll(player);
		return;
	}

	const ids = decodePets(player.GetAttribute(PETS_ATTRIBUTE));
	if (ids.size() === 0) {
		releaseAll(player);
		return;
	}
	const rigs = rigsByPlayer.get(player) ?? [];
	rigsByPlayer.set(player, rigs);

	while (rigs.size() > ids.size()) {
		const extra = rigs.pop();
		if (extra !== undefined) {
			releaseRig(extra);
		}
	}
	while (rigs.size() < ids.size()) {
		// A new pet starts at its owner, so it flies out instead of popping in far away.
		rigs.push({ part: acquirePart(), itemId: undefined, position: root.Position });
	}

	ids.forEach((itemId, index) => {
		const rig = rigs[index];
		if (rig.itemId !== itemId) {
			style(rig, itemId);
		}
		const offset = petOffset(index, ids.size(), time);
		const target = root.CFrame.mul(new CFrame(offset.x, offset.y, offset.z)).Position;
		rig.position = rig.position.sub(target).Magnitude > SNAP_DISTANCE ? target : rig.position.Lerp(target, alpha);
		rig.part.CFrame = new CFrame(rig.position);
	});
}

export function startPetsController(): void {
	Players.PlayerRemoving.Connect(releaseAll);
	RunService.Heartbeat.Connect((deltaSeconds) => {
		const alpha = followAlpha(deltaSeconds, FOLLOW_RATE);
		const time = os.clock();
		const cameraPosition = Workspace.CurrentCamera?.CFrame.Position;
		for (const player of Players.GetPlayers()) {
			// pcall so one broken character never stops the pets of everyone else.
			pcall(updatePlayer, player, alpha, time, cameraPosition);
		}
	});
}
