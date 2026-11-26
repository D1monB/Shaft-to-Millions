// Ore in the map author's mine (decisions 034, 038). Map/Mine/OreSpawns/Tier<N> holds the spawn points of layer N;
// the deepest layer's points near the portal grow iridium. Only a share of the points hold ore, picked at random, and
// every minute some blocks no one is standing at move to free points, so the mine changes and is not a ring of blocks.
// A block is the map author's raw-ore model (ServerStorage.ItemTemplates/<ore>, Stage 0) scaled up, or a plain coloured
// block if the model is missing. Blocks are tagged OreNode, so the mining service picks them up; they exist only while
// the server runs, the place file is never changed.
import { CollectionService, Players, ServerStorage, Workspace } from "@rbxts/services";
import { ATTRIBUTES, ORE_SPAWNS, PLOTS, PLOT_ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { ORES, OreId } from "shared/config/ores";
import { ITEM_TEMPLATES_FOLDER } from "shared/features/line";
import {
	ORE_FILL_FRACTION,
	ORE_SHUFFLE_CLEAR_RADIUS,
	ORE_SHUFFLE_FRACTION,
	ORE_SHUFFLE_SECONDS,
	activeCount,
	oreForSpawn,
	pickRandom,
	tierOf,
} from "shared/features/mining";

/** Size of one ore block (studs, its longest side). 8 = the map author's choice (their OreNodeScale script did the same). */
const NODE_SIZE = 8;

interface SpawnPoint {
	readonly spawn: BasePart;
	readonly oreId: OreId;
}

interface Layer {
	readonly points: ReadonlyArray<SpawnPoint>;
	/** The block standing on each occupied point. */
	readonly blocks: Map<SpawnPoint, Instance>;
}

const random = new Random();
const nextNumber = () => random.NextNumber();
const templates = new Map<OreId, Model | false>();

function flatDistance(a: Vector3, b: Vector3): number {
	return new Vector2(a.X - b.X, a.Z - b.Z).Magnitude;
}

/** The map author's raw-ore model for this ore, found once by its Ore / Stage attributes. */
function templateFor(oreId: OreId): Model | undefined {
	const cached = templates.get(oreId);
	if (cached !== undefined) {
		return cached === false ? undefined : cached;
	}
	const folder = ServerStorage.FindFirstChild(ITEM_TEMPLATES_FOLDER)?.FindFirstChild(oreId);
	const found = folder
		?.GetChildren()
		.find((child): child is Model => child.IsA("Model") && child.GetAttribute(PLOT_ATTRIBUTES.Stage) === 0);
	templates.set(oreId, found ?? false);
	if (found === undefined) {
		warn(`[ore] no raw-ore model in ServerStorage.${ITEM_TEMPLATES_FOLDER}.${oreId}; plain blocks are used`);
	}
	return found;
}

function plainBlock(oreId: OreId): Part {
	const [r, g, b] = ORES[oreId].color;
	const block = new Instance("Part");
	block.Size = new Vector3(NODE_SIZE, NODE_SIZE, NODE_SIZE);
	block.Color = Color3.fromRGB(r, g, b);
	block.Material = Enum.Material.Slate;
	block.TopSurface = Enum.SurfaceType.Smooth;
	block.BottomSurface = Enum.SurfaceType.Smooth;
	return block;
}

function modelBlock(template: Model): Model {
	const model = template.Clone();
	for (const descendant of model.GetDescendants()) {
		if (descendant.IsA("BasePart")) {
			descendant.Anchored = true;
			descendant.CanCollide = true;
		} else if (descendant.IsA("LuaSourceContainer")) {
			descendant.Destroy();
		}
	}
	const longest = math.max(model.GetExtentsSize().X, model.GetExtentsSize().Y, model.GetExtentsSize().Z);
	if (longest > 0) {
		model.ScaleTo(model.GetScale() * (NODE_SIZE / longest));
	}
	return model;
}

/** Puts a block on the point, its bottom on the point's bottom, turned at random so blocks do not all look alike. */
function makeBlock(point: SpawnPoint, parent: Instance): Instance {
	const template = templateFor(point.oreId);
	const block: PVInstance = template !== undefined ? modelBlock(template) : plainBlock(point.oreId);
	block.Name = `Ore_${point.oreId}`;
	if (block.IsA("BasePart")) {
		block.Anchored = true;
	}
	const turn = CFrame.Angles(0, random.NextNumber() * 2 * math.pi, 0);
	const floor = point.spawn.Position.Y - point.spawn.Size.Y / 2;
	block.PivotTo(new CFrame(point.spawn.Position).mul(turn));
	const [box, size] = block.IsA("Model")
		? block.GetBoundingBox()
		: block.IsA("BasePart")
			? [block.CFrame, block.Size]
			: [block.GetPivot(), Vector3.zero];
	block.PivotTo(block.GetPivot().add(new Vector3(0, floor - (box.Position.Y - size.Y / 2), 0)));
	block.SetAttribute(ATTRIBUTES.OreId, point.oreId);
	block.Parent = parent;
	CollectionService.AddTag(block, TAGS.OreNode);
	return block;
}

function playerNear(position: Vector3): boolean {
	return Players.GetPlayers().some((player) => {
		const root = player.Character?.FindFirstChild("HumanoidRootPart");
		return (
			root !== undefined &&
			root.IsA("BasePart") &&
			root.Position.sub(position).Magnitude < ORE_SHUFFLE_CLEAR_RADIUS
		);
	});
}

/** Moves a share of the layer's blocks that nobody stands at to free points. */
function shuffle(layer: Layer, parent: Instance): void {
	const free = layer.points.filter((point) => !layer.blocks.has(point));
	const movable = new Array<SpawnPoint>();
	for (const [point] of layer.blocks) {
		if (!playerNear(point.spawn.Position)) {
			movable.push(point);
		}
	}
	const count = math.min(activeCount(layer.blocks.size(), ORE_SHUFFLE_FRACTION), free.size(), movable.size());
	const targets = pickRandom(free, count, nextNumber);
	pickRandom(movable, count, nextNumber).forEach((from, index) => {
		// Destroyed, not moved: the mining service forgets a removed node, so no one keeps damage or a cooldown on it.
		layer.blocks.get(from)?.Destroy();
		layer.blocks.delete(from);
		const to = targets[index];
		layer.blocks.set(to, makeBlock(to, parent));
	});
}

function readLayers(spawns: Instance, portalPosition: Vector3 | undefined): Array<Layer> {
	const layers = new Array<Layer>();
	for (const tierFolder of spawns.GetChildren()) {
		const tier = tierOf(tierFolder.Name);
		if (tier === undefined) {
			continue;
		}
		const points = new Array<SpawnPoint>();
		for (const spawn of tierFolder.GetChildren()) {
			if (spawn.IsA("BasePart")) {
				const distance =
					portalPosition !== undefined ? flatDistance(spawn.Position, portalPosition) : undefined;
				const oreId = oreForSpawn(tier, distance);
				if (oreId !== undefined) {
					points.push({ spawn, oreId });
				}
			}
		}
		layers.push({ points, blocks: new Map() });
	}
	return layers;
}

/** Builds the ore blocks and starts moving them; returns how many. Run before the mining service starts. */
export function spawnMapOre(): number {
	const mine = Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(ORE_SPAWNS.Mine);
	const spawns = mine?.FindFirstChild(ORE_SPAWNS.Spawns);
	if (spawns === undefined) {
		return 0;
	}
	const portal = mine?.FindFirstChild(ORE_SPAWNS.PortalModel)?.FindFirstChild(ORE_SPAWNS.Portal);
	const portalPosition = portal !== undefined && portal.IsA("BasePart") ? portal.Position : undefined;
	const folder = new Instance("Folder");
	folder.Name = "MapOre";
	const layers = readLayers(spawns, portalPosition);
	let count = 0;
	for (const layer of layers) {
		for (const point of pickRandom(layer.points, activeCount(layer.points.size(), ORE_FILL_FRACTION), nextNumber)) {
			layer.blocks.set(point, makeBlock(point, folder));
			count += 1;
		}
	}
	folder.Parent = Workspace;
	task.spawn(() => {
		for (;;) {
			task.wait(ORE_SHUFFLE_SECONDS);
			for (const layer of layers) {
				// pcall: one broken model must not stop the ore of every other layer.
				pcall(shuffle, layer, folder);
			}
		}
	});
	return count;
}
