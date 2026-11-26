// Ore in the map author's mine (decisions 034, 038). Map/Mine/OreSpawns/Tier<N> holds the spawn points of layer N;
// the deepest layer's points near the portal grow iridium. Only a share of the points hold ore, picked at random, and
// every minute some blocks no one is standing at move to free points, so the mine changes and is not a ring of blocks.
// A block is the map author's raw-ore model (ServerStorage.ItemTemplates/<ore>, Stage 0) scaled up, or a plain coloured
// block if the model is missing. Blocks are tagged OreNode, so the mining service picks them up; they exist only while
// the server runs, the place file is never changed.
import { CollectionService, Players, ServerStorage, Workspace } from "@rbxts/services";
import { CLUSTER_EVERY_SECONDS, EVENT_BLOCK_LIFETIME_SECONDS } from "shared/config/events";
import { getLoadedPlayers, getProfileData } from "server/features/profile";
import { ATTRIBUTES, ORE_SPAWNS, PLOTS, PLOT_ATTRIBUTES, TAGS, TREASURE } from "shared/config/map-contract";
import { ORES, OreId } from "shared/config/ores";
import { nameKeys, ref, text } from "shared/features/i18n";
import { ITEM_TEMPLATES_FOLDER } from "shared/features/line";
import {
	ORE_FILL_FRACTION,
	ORE_SHUFFLE_CLEAR_RADIUS,
	ORE_SHUFFLE_FRACTION,
	ORE_RUSH_EVERY_SECONDS,
	ORE_RUSH_RICH_SHARE,
	ORE_RUSH_SECONDS,
	ORE_SHUFFLE_SECONDS,
	GEODE_CHANCE,
	RICH_ORE_CHANCE,
	TREASURE_EVERY_SECONDS,
	activeCount,
	oreForSpawn,
	pickRandom,
	tierOf,
} from "shared/features/mining";
import { localizeLabel } from "server/lib/localized";
import { notify } from "server/lib/notify";

/** Size of one ore block (studs, its longest side). 8 = the map author's choice (their OreNodeScale script did the same). */
const NODE_SIZE = 8;

interface SpawnPoint {
	readonly spawn: BasePart;
	readonly oreId: OreId;
}

interface Layer {
	readonly tier: number;
	readonly points: ReadonlyArray<SpawnPoint>;
	/** The block standing on each occupied point. */
	readonly blocks: Map<SpawnPoint, Instance>;
}

const random = new Random();
const nextNumber = () => random.NextNumber();
const templates = new Map<OreId, Model | false>();
const SPARKLES_NAME = "RichSparkles";

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

/** A rich vein (decision 046): sparkles in the ore's colour and a server-set attribute the mining service reads. */
function makeRich(block: Instance, oreId: OreId): void {
	block.SetAttribute(ATTRIBUTES.Rich, true);
	const part = block.IsA("BasePart") ? block : block.FindFirstChildWhichIsA("BasePart", true);
	if (part !== undefined) {
		const [r, g, b] = ORES[oreId].color;
		const sparkles = new Instance("Sparkles");
		sparkles.Name = SPARKLES_NAME;
		sparkles.SparkleColor = Color3.fromRGB(r, g, b);
		sparkles.Parent = part;
	}
}

/** A geode (decision 060): a purple glow and a server-set attribute; the mining service pays crystals for it. */
function makeGeode(block: Instance): void {
	block.SetAttribute(ATTRIBUTES.Geode, true);
	const part = block.IsA("BasePart") ? block : block.FindFirstChildWhichIsA("BasePart", true);
	if (part !== undefined) {
		const light = new Instance("PointLight");
		light.Color = Color3.fromRGB(190, 110, 255);
		light.Brightness = 3;
		light.Range = 12;
		light.Parent = part;
		const sparkles = new Instance("Sparkles");
		sparkles.SparkleColor = Color3.fromRGB(200, 130, 255);
		sparkles.Parent = part;
	}
}

function makePlain(block: Instance): void {
	block.SetAttribute(ATTRIBUTES.Rich, undefined);
	block.FindFirstChild(SPARKLES_NAME, true)?.Destroy();
}

/**
 * An ore rush (decision 048): for a minute a share of the plain blocks nobody stands at turn rich, announced to
 * everyone. Afterwards exactly those blocks turn plain again (blocks moved by a shuffle meanwhile are simply gone).
 */
function oreRush(layers: ReadonlyArray<Layer>): void {
	const enriched = new Array<Instance>();
	for (const layer of layers) {
		const plain = new Array<SpawnPoint>();
		for (const [point, block] of layer.blocks) {
			if (block.GetAttribute(ATTRIBUTES.Rich) !== true && !playerNear(point.spawn.Position)) {
				plain.push(point);
			}
		}
		for (const point of pickRandom(plain, activeCount(plain.size(), ORE_RUSH_RICH_SHARE), nextNumber)) {
			const block = layer.blocks.get(point);
			if (block !== undefined) {
				makeRich(block, point.oreId);
				enriched.push(block);
			}
		}
	}
	for (const player of Players.GetPlayers()) {
		notify(player, text("mining.rushStart", { seconds: ORE_RUSH_SECONDS }), "success");
	}
	task.wait(ORE_RUSH_SECONDS);
	for (const block of enriched) {
		if (block.Parent !== undefined) {
			makePlain(block);
		}
	}
	for (const player of Players.GetPlayers()) {
		notify(player, text("mining.rushEnd"), "info");
	}
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
	const luck = random.NextNumber();
	if (luck < RICH_ORE_CHANCE) {
		makeRich(block, point.oreId);
	} else if (luck < RICH_ORE_CHANCE + GEODE_CHANCE) {
		makeGeode(block);
	}
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
	const free = layer.points.filter((point) => !layer.blocks.has(point) && !isEventPoint(point));
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
		layers.push({ tier, points, blocks: new Map() });
	}
	return layers;
}

/** Size of the treasure crate (studs, its longest side). */
const TREASURE_SIZE = 6;

/** The waiting treasure crate, if any (decision 050). */
let treasure: { readonly point: SpawnPoint; readonly block: Instance } | undefined;

function treasureBlock(): PVInstance {
	const template = ServerStorage.FindFirstChild(TREASURE.TemplateFolder)?.FindFirstChild(TREASURE.Model);
	if (template !== undefined && template.IsA("Model")) {
		const model = template.Clone();
		for (const descendant of model.GetDescendants()) {
			if (descendant.IsA("BasePart")) {
				descendant.Anchored = true;
			} else if (descendant.IsA("LuaSourceContainer")) {
				descendant.Destroy();
			}
		}
		const size = model.GetExtentsSize();
		const longest = math.max(size.X, size.Y, size.Z);
		if (longest > 0) {
			model.ScaleTo(model.GetScale() * (TREASURE_SIZE / longest));
		}
		return model;
	}
	const block = new Instance("Part");
	block.Anchored = true;
	block.Size = new Vector3(TREASURE_SIZE, TREASURE_SIZE * 0.7, TREASURE_SIZE * 0.8);
	block.Color = Color3.fromRGB(245, 200, 60);
	block.Material = Enum.Material.Metal;
	return block;
}

/** A gold glow and a label seen from far away, so players run to it. */
function decorateTreasure(block: Instance): void {
	const part = block.IsA("BasePart") ? block : block.FindFirstChildWhichIsA("BasePart", true);
	if (part === undefined) {
		return;
	}
	const sparkles = new Instance("Sparkles");
	sparkles.SparkleColor = Color3.fromRGB(255, 215, 80);
	sparkles.Parent = part;
	const light = new Instance("PointLight");
	light.Color = Color3.fromRGB(255, 200, 90);
	light.Range = 18;
	light.Brightness = 2;
	light.Parent = part;
	const gui = new Instance("BillboardGui");
	gui.Size = UDim2.fromOffset(160, 40);
	gui.StudsOffsetWorldSpace = new Vector3(0, TREASURE_SIZE, 0);
	gui.AlwaysOnTop = true;
	gui.MaxDistance = 250;
	const label = new Instance("TextLabel");
	label.BackgroundTransparency = 1;
	label.Size = UDim2.fromScale(1, 1);
	label.Font = Enum.Font.FredokaOne;
	label.TextScaled = true;
	label.TextColor3 = Color3.fromRGB(253, 224, 71);
	label.TextStrokeTransparency = 0.1;
	label.Parent = gui;
	localizeLabel(label, text("mining.treasureLabel"));
	gui.Parent = part;
}

/** Layers someone on this server has opened: a treasure nobody can reach would sit there for ever. */
function openLayers(layers: ReadonlyArray<Layer>): Layer[] {
	let deepest = 1;
	for (const player of getLoadedPlayers()) {
		deepest = math.max(deepest, getProfileData(player)?.deepestLayer ?? 1);
	}
	return layers.filter((layer) => layer.tier <= deepest);
}

/** An event block nobody took is removed after a while, so the next one can come. */
function expire(block: Instance): void {
	task.delay(EVENT_BLOCK_LIFETIME_SECONDS, () => {
		if (block.Parent !== undefined) {
			block.Destroy();
		}
	});
}

/** Puts a treasure crate on a random free point of a random layer and tells everyone where. */
function spawnTreasure(layers: ReadonlyArray<Layer>, parent: Instance): void {
	if (treasure !== undefined && treasure.block.Parent !== undefined) {
		return;
	}
	treasure = undefined;
	const candidates = openLayers(layers).filter((layer) =>
		layer.points.some((point) => !layer.blocks.has(point) && !isEventPoint(point)),
	);
	const [layer] = pickRandom(candidates, 1, nextNumber);
	if (layer === undefined) {
		return;
	}
	const [point] = pickRandom(
		layer.points.filter((candidate) => !layer.blocks.has(candidate) && !isEventPoint(candidate)),
		1,
		nextNumber,
	);
	if (point === undefined) {
		return;
	}
	const block = treasureBlock();
	block.Name = "Treasure";
	block.PivotTo(new CFrame(point.spawn.Position));
	const [box, size] = block.IsA("Model")
		? block.GetBoundingBox()
		: block.IsA("BasePart")
			? [block.CFrame, block.Size]
			: [block.GetPivot(), Vector3.zero];
	const floor = point.spawn.Position.Y - point.spawn.Size.Y / 2;
	block.PivotTo(block.GetPivot().add(new Vector3(0, floor - (box.Position.Y - size.Y / 2), 0)));
	block.SetAttribute(ATTRIBUTES.OreId, point.oreId);
	block.SetAttribute(ATTRIBUTES.Treasure, true);
	decorateTreasure(block);
	block.Parent = parent;
	CollectionService.AddTag(block, TAGS.OreNode);
	treasure = { point, block };
	expire(block);
	for (const player of Players.GetPlayers()) {
		notify(player, text("mining.treasureSpawned", { layer: ref(nameKeys.layer(layer.tier)) }), "success");
	}
}

/** The waiting crystal cluster, if any (decision 065). */
let cluster: { readonly point: SpawnPoint; readonly block: Instance } | undefined;

/** A point holding a treasure or a cluster: ore blocks keep off it. */
function isEventPoint(point: SpawnPoint): boolean {
	return point === treasure?.point || (cluster?.block.Parent !== undefined && point === cluster.point);
}

/** A tall glowing crystal made of neon shards, with a label seen from far away. */
function clusterModel(): Model {
	const model = new Instance("Model");
	const colors = [Color3.fromRGB(140, 220, 255), Color3.fromRGB(180, 130, 255), Color3.fromRGB(120, 255, 220)];
	for (let i = 0; i < 7; i++) {
		const shard = new Instance("Part");
		shard.Anchored = true;
		shard.Material = Enum.Material.Neon;
		shard.Color = colors[i % 3];
		const height = i === 0 ? 8 : 4 + (i % 3);
		shard.Size = new Vector3(1.4, height, 1.4);
		const angle = (i / 6) * math.pi * 2;
		const radius = i === 0 ? 0 : 2.2;
		shard.CFrame = new CFrame(math.cos(angle) * radius, height / 2, math.sin(angle) * radius).mul(
			CFrame.Angles(math.sin(angle) * 0.35, 0, -math.cos(angle) * 0.35),
		);
		shard.Parent = model;
		if (i === 0) {
			model.PrimaryPart = shard;
		}
	}
	return model;
}

/** Puts the shared cluster on a free point of a random layer and tells everyone. */
function spawnCluster(layers: ReadonlyArray<Layer>, parent: Instance): void {
	if (cluster !== undefined && cluster.block.Parent !== undefined) {
		return;
	}
	const free = (layer: Layer) => layer.points.filter((point) => !layer.blocks.has(point) && !isEventPoint(point));
	const [layer] = pickRandom(
		openLayers(layers).filter((candidate) => free(candidate).size() > 0),
		1,
		nextNumber,
	);
	if (layer === undefined) {
		return;
	}
	const [point] = pickRandom(free(layer), 1, nextNumber);
	if (point === undefined) {
		return;
	}
	const model = clusterModel();
	model.Name = "CrystalCluster";
	const floor = point.spawn.Position.Y - point.spawn.Size.Y / 2;
	model.PivotTo(new CFrame(point.spawn.Position.X, floor + 4, point.spawn.Position.Z));
	model.SetAttribute(ATTRIBUTES.OreId, point.oreId);
	model.SetAttribute(ATTRIBUTES.Cluster, true);
	decorateCluster(model);
	model.Parent = parent;
	CollectionService.AddTag(model, TAGS.OreNode);
	cluster = { point, block: model };
	expire(model);
	for (const player of Players.GetPlayers()) {
		notify(player, text("events.clusterSpawned", { layer: ref(nameKeys.layer(layer.tier)) }), "success");
	}
}

function decorateCluster(model: Model): void {
	const part = model.PrimaryPart;
	if (part === undefined) {
		return;
	}
	const light = new Instance("PointLight");
	light.Color = Color3.fromRGB(150, 200, 255);
	light.Range = 30;
	light.Brightness = 3;
	light.Parent = part;
	const gui = new Instance("BillboardGui");
	gui.Size = UDim2.fromOffset(200, 40);
	gui.StudsOffsetWorldSpace = new Vector3(0, 8, 0);
	gui.AlwaysOnTop = true;
	gui.MaxDistance = 250;
	const label = new Instance("TextLabel");
	label.BackgroundTransparency = 1;
	label.Size = UDim2.fromScale(1, 1);
	label.Font = Enum.Font.FredokaOne;
	label.TextScaled = true;
	label.TextColor3 = Color3.fromRGB(150, 230, 255);
	label.TextStrokeTransparency = 0.1;
	label.Parent = gui;
	localizeLabel(label, text("events.clusterLabel"));
	gui.Parent = part;
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
			task.wait(CLUSTER_EVERY_SECONDS);
			const [ok, err] = pcall(spawnCluster, layers, folder);
			if (!ok) {
				warn(`[ore] cluster failed: ${err}`);
			}
		}
	});
	task.spawn(() => {
		for (;;) {
			task.wait(TREASURE_EVERY_SECONDS);
			const [ok, err] = pcall(spawnTreasure, layers, folder);
			if (!ok) {
				warn(`[ore] treasure failed: ${err}`);
			}
		}
	});
	task.spawn(() => {
		for (;;) {
			task.wait(ORE_RUSH_EVERY_SECONDS);
			// pcall: a failed rush must not end the loop (no rush ever again).
			const [ok, err] = pcall(oreRush, layers);
			if (!ok) {
				warn(`[ore] rush failed: ${err}`);
			}
		}
	});
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
