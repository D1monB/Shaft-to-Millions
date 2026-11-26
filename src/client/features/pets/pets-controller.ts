// Draws the pets of every player and moves them smoothly after their owner. Effects only: the server publishes WHICH
// pets are equipped (a Player attribute) and never moves anything. The look is the map author's model
// ReplicatedStorage.PetModels/<itemId> (a neon ball if a model is missing). Visuals are pooled per pet, so equipping,
// leaving or walking away creates no garbage, and far-away players cost nothing.
import { Players, ReplicatedStorage, RunService, Workspace } from "@rbxts/services";
import { ITEMS, ItemId, RARITY_COLORS } from "shared/config/items";
import { PETS_ATTRIBUTE, decodePets, followAlpha, petOffset } from "shared/features/equipment";

/** How fast a pet catches up with its target (higher = stiffer). */
const FOLLOW_RATE = 8;
/** How fast a pet turns to face where its owner faces. */
const TURN_RATE = 6;
/** If a pet is farther than this from its target (a teleport or respawn), it jumps instead of flying across the map. */
const SNAP_DISTANCE = 40;
/** Players farther than this from the camera get no pets drawn: invisible anyway, and it saves mobile devices work. */
const RENDER_DISTANCE = 120;
const BALL_SIZE = 1.2;
const FOLDER_NAME = "ClientPets";
/** The map author's pet models, named by item id. */
const MODELS_FOLDER = "PetModels";
/** Wing flap of models that mark wing parts (attribute Wing = -1 left / 1 right, hinges HingeL / HingeR on the model). */
const FLAP_SPEED = 16;
const FLAP_ANGLE = math.rad(38);
const SWAY_ANGLE = math.rad(6);
const BOB_ANGLE = math.rad(4);

/** One drawn pet: its parts and where each sits relative to the pivot. */
interface Visual {
	readonly itemId: ItemId;
	readonly root: Instance;
	readonly parts: ReadonlyArray<BasePart>;
	readonly rest: ReadonlyArray<CFrame>;
	readonly wing: ReadonlyArray<number>;
	readonly hingeLeft: Vector3;
	readonly hingeRight: Vector3;
}

interface PetRig {
	visual: Visual | undefined;
	position: Vector3;
	yaw: number;
	readonly seed: number;
}

const rigsByPlayer = new Map<Player, PetRig[]>();
/** Visuals waiting to be reused, by pet. */
const pool = new Map<ItemId, Visual[]>();
let folder: Folder | undefined;
let nextSeed = 0;

function getFolder(): Folder {
	if (folder === undefined || folder.Parent === undefined) {
		const created = new Instance("Folder");
		created.Name = FOLDER_NAME;
		created.Parent = Workspace;
		folder = created;
	}
	return folder;
}

function quiet(part: BasePart): void {
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.CastShadow = false;
}

function vectorAttribute(instance: Instance, name: string): Vector3 {
	const value = instance.GetAttribute(name);
	return typeIs(value, "Vector3") ? value : Vector3.zero;
}

function buildFromModel(itemId: ItemId, template: Model): Visual {
	const model = template.Clone();
	const pivot = model.GetPivot();
	const parts: BasePart[] = [];
	const rest: CFrame[] = [];
	const wing: number[] = [];
	for (const descendant of model.GetDescendants()) {
		if (descendant.IsA("BasePart")) {
			quiet(descendant);
			parts.push(descendant);
			rest.push(pivot.ToObjectSpace(descendant.CFrame));
			const side = descendant.GetAttribute("Wing");
			wing.push(typeIs(side, "number") && side === side ? math.clamp(side, -1, 1) : 0);
		}
	}
	return {
		itemId,
		root: model,
		parts,
		rest,
		wing,
		hingeLeft: vectorAttribute(template, "HingeL"),
		hingeRight: vectorAttribute(template, "HingeR"),
	};
}

function buildBall(itemId: ItemId): Visual {
	const part = new Instance("Part");
	part.Name = itemId;
	part.Shape = Enum.PartType.Ball;
	part.Size = new Vector3(BALL_SIZE, BALL_SIZE, BALL_SIZE);
	part.Material = Enum.Material.Neon;
	const color = RARITY_COLORS[ITEMS[itemId].rarity];
	part.Color = Color3.fromRGB(color[0], color[1], color[2]);
	quiet(part);
	return {
		itemId,
		root: part,
		parts: [part],
		rest: [CFrame.identity],
		wing: [0],
		hingeLeft: Vector3.zero,
		hingeRight: Vector3.zero,
	};
}

function acquireVisual(itemId: ItemId): Visual {
	const visual = pool.get(itemId)?.pop() ?? buildVisual(itemId);
	visual.root.Parent = getFolder();
	return visual;
}

function buildVisual(itemId: ItemId): Visual {
	const template = ReplicatedStorage.FindFirstChild(MODELS_FOLDER)?.FindFirstChild(itemId);
	return template !== undefined && template.IsA("Model") ? buildFromModel(itemId, template) : buildBall(itemId);
}

function releaseVisual(rig: PetRig): void {
	const visual = rig.visual;
	if (visual === undefined) {
		return;
	}
	visual.root.Parent = undefined;
	const list = pool.get(visual.itemId) ?? [];
	list.push(visual);
	pool.set(visual.itemId, list);
	rig.visual = undefined;
}

function releaseAll(player: Player): void {
	const rigs = rigsByPlayer.get(player);
	if (rigs === undefined) {
		return;
	}
	for (const rig of rigs) {
		releaseVisual(rig);
	}
	rigsByPlayer.delete(player);
}

/** Collected every frame and moved in one BulkMoveTo call: much cheaper than moving parts one by one. */
const movedParts: BasePart[] = [];
const movedFrames: CFrame[] = [];

function placeVisual(rig: PetRig, visual: Visual, time: number): void {
	const sway = math.sin(time * 1.6 + rig.seed) * SWAY_ANGLE;
	const bob = math.sin(time * 2.1 + rig.seed) * BOB_ANGLE;
	const frame = new CFrame(rig.position).mul(CFrame.Angles(0, rig.yaw, 0)).mul(CFrame.Angles(bob, 0, sway));
	const flap = math.sin(time * FLAP_SPEED + rig.seed) * FLAP_ANGLE;
	visual.parts.forEach((part, index) => {
		let rest = visual.rest[index];
		const side = visual.wing[index];
		if (side !== 0) {
			const hinge = side < 0 ? visual.hingeLeft : visual.hingeRight;
			rest = new CFrame(hinge)
				.mul(CFrame.Angles(0, 0, side * flap))
				.mul(new CFrame(hinge.mul(-1)))
				.mul(rest);
		}
		movedParts.push(part);
		movedFrames.push(frame.mul(rest));
	});
}

function updatePlayer(
	player: Player,
	alpha: number,
	turn: number,
	time: number,
	cameraPosition: Vector3 | undefined,
): void {
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
			releaseVisual(extra);
		}
	}
	while (rigs.size() < ids.size()) {
		// A new pet starts at its owner, so it flies out instead of popping in far away.
		nextSeed += 1;
		rigs.push({ visual: undefined, position: root.Position, yaw: 0, seed: nextSeed });
	}

	const look = root.CFrame.LookVector;
	const targetYaw = math.atan2(-look.X, -look.Z);
	ids.forEach((itemId, index) => {
		const rig = rigs[index];
		if (rig.visual?.itemId !== itemId) {
			releaseVisual(rig);
			rig.visual = acquireVisual(itemId);
		}
		const offset = petOffset(index, ids.size(), time);
		const target = root.CFrame.mul(new CFrame(offset.x, offset.y, offset.z)).Position;
		rig.position = rig.position.sub(target).Magnitude > SNAP_DISTANCE ? target : rig.position.Lerp(target, alpha);
		// Shortest way round, so a pet never spins a full circle when the angle wraps past 180 degrees.
		const diff = ((targetYaw - rig.yaw + math.pi) % (2 * math.pi)) - math.pi;
		rig.yaw += diff * turn;
		placeVisual(rig, rig.visual, time);
	});
}

export function startPetsController(): void {
	Players.PlayerRemoving.Connect(releaseAll);
	RunService.Heartbeat.Connect((deltaSeconds) => {
		const alpha = followAlpha(deltaSeconds, FOLLOW_RATE);
		const turn = followAlpha(deltaSeconds, TURN_RATE);
		const time = os.clock();
		const cameraPosition = Workspace.CurrentCamera?.CFrame.Position;
		movedParts.clear();
		movedFrames.clear();
		for (const player of Players.GetPlayers()) {
			// pcall so one broken character never stops the pets of everyone else.
			pcall(updatePlayer, player, alpha, turn, time, cameraPosition);
		}
		if (movedParts.size() > 0) {
			Workspace.BulkMoveTo(movedParts, movedFrames, Enum.BulkMoveMode.FireCFrameChanged);
		}
	});
}
