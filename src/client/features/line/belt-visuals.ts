// Items riding the belts of all plots. The server only says "an item of ore X left place Y of plot Z" (LineFlow,
// unreliable); the route comes from the plot's BeltPath value and the look from the map author's ItemTemplates
// (one model per ore and stage). Purely visual: nothing here affects money, and a lost message just skips an item.
// Models are pooled per ore and stage, and plots far from the camera are skipped, so busy lines stay cheap on phones.
import { HttpService, ReplicatedStorage, RunService, Workspace } from "@rbxts/services";
import { LINE_MACHINES } from "shared/config/line";
import { PLOTS, PLOT_ATTRIBUTES } from "shared/config/map-contract";
import { ORES, ORE_IDS, OreId } from "shared/config/ores";
import {
	BELT_PATH_VALUE,
	ITEM_TEMPLATES_FOLDER,
	LINE_FLOW_REMOTE,
	StoredBeltPath,
	parseBeltPath,
	pathBetween,
	routeFor,
} from "shared/features/line";
import { onServerUnreliable } from "client/lib/remotes";

/** Ride speed in studs per second. Visual only: the server's timing does not depend on it. */
const ITEM_SPEED = 8;
/** A ride never lasts longer than this, so a long belt does not pile up items. */
const MAX_RIDE_SECONDS = 12;
/** Shortest ride (s), so a short hop is still seen. */
const MIN_RIDE_SECONDS = 0.8;
/** Ride to the SellStation (s): nothing waits for it there. */
const SELL_RIDE_SECONDS = 4;
/** Items on screen at once (all plots together); extra items are simply not shown. */
const MAX_ACTIVE_ITEMS = 120;
/** Plots farther than this from the camera show no items. */
const VISIBLE_DISTANCE = 300;
/**
 * The server reports a whole second of moves at once; items leaving the same place in one message start this many
 * seconds apart, so they ride in a row instead of on top of each other.
 */
const ITEM_GAP_SECONDS = 0.3;
/** Size of the fallback cube when the map has no model for an ore and stage. */
const FALLBACK_SIZE = 0.8;

interface Ride {
	readonly key: string;
	readonly model: Model;
	readonly points: ReadonlyArray<Vector3>;
	/** Distance from the start to each point. */
	readonly lengths: ReadonlyArray<number>;
	readonly speed: number;
	/** Seconds before the item appears (see ITEM_GAP_SECONDS). */
	wait: number;
	travelled: number;
	/** Index of the path point the item is heading to; it only moves forward. */
	segment: number;
}

interface CachedPath {
	readonly source: StringValue;
	readonly text: string;
	readonly path: StoredBeltPath | undefined;
}

const rides: Ride[] = [];
const pool = new Map<string, Model[]>();
const pathCache = new Map<number, CachedPath>();
let itemsFolder: Folder | undefined;

function getItemsFolder(): Folder {
	if (itemsFolder === undefined || itemsFolder.Parent === undefined) {
		const folder = new Instance("Folder");
		folder.Name = "BeltItems";
		folder.Parent = Workspace;
		itemsFolder = folder;
	}
	return itemsFolder;
}

// ---- finding plots and their belt paths ----

function findPlot(plotIndex: number): Instance | undefined {
	const plots = Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(PLOTS.PlotsFolder);
	for (const plot of plots?.GetChildren() ?? []) {
		if (plot.GetAttribute(PLOT_ATTRIBUTES.PlotIndex) === plotIndex) {
			return plot;
		}
	}
	return undefined;
}

/** The parsed belt path of a built plot, re-read only when the server rebuilt the plot (a new value). */
function beltPathOf(plotIndex: number, factory: Instance): StoredBeltPath | undefined {
	const value = factory.FindFirstChild(BELT_PATH_VALUE);
	if (value === undefined || !value.IsA("StringValue")) {
		return undefined;
	}
	const cached = pathCache.get(plotIndex);
	if (cached !== undefined && cached.source === value && cached.text === value.Value) {
		return cached.path;
	}
	const [ok, decoded] = pcall(() => HttpService.JSONDecode(value.Value));
	const path = ok ? parseBeltPath(decoded) : undefined;
	if (path === undefined) {
		warn(`[line] belt path of plot ${plotIndex} is unreadable: its belt shows no items`);
	}
	pathCache.set(plotIndex, { source: value, text: value.Value, path });
	return path;
}

function ownedMachines(factory: Instance): number {
	return factory.FindFirstChild(PLOTS.Machines)?.GetChildren().size() ?? 0;
}

// ---- item models ----

function stageOf(template: Instance): number | undefined {
	const attribute = template.GetAttribute(PLOT_ATTRIBUTES.Stage);
	if (typeIs(attribute, "number")) {
		return attribute;
	}
	// The map author names them "<NN><name>": the leading number is the stage.
	const digits = template.Name.match("^%d+")[0];
	return typeIs(digits, "string") ? tonumber(digits) : undefined;
}

/** Item models by "ore:stage", read once from the map author's attributes (Ore, Stage) on each model. */
let templateIndex: Map<string, Model> | undefined;

function buildTemplateIndex(): Map<string, Model> {
	const index = new Map<string, Model>();
	for (const folder of ReplicatedStorage.FindFirstChild(ITEM_TEMPLATES_FOLDER)?.GetChildren() ?? []) {
		for (const model of folder.GetChildren()) {
			if (!model.IsA("Model")) {
				continue;
			}
			// The Ore attribute wins; a model without it belongs to the ore its folder is named after.
			const oreAttribute = model.GetAttribute("Ore");
			const ore = typeIs(oreAttribute, "string") ? oreAttribute : folder.Name;
			const stage = stageOf(model);
			if (stage !== undefined && !index.has(`${ore}:${stage}`)) {
				index.set(`${ore}:${stage}`, model);
			}
		}
	}
	return index;
}

function findTemplate(ore: OreId, stage: number): Model | undefined {
	// The folder arrives from the server a moment after the client starts: index it once it is there.
	if (templateIndex === undefined || templateIndex.size() === 0) {
		templateIndex = buildTemplateIndex();
	}
	return templateIndex.get(`${ore}:${stage}`);
}

function fallbackModel(ore: OreId): Model {
	const model = new Instance("Model");
	const part = new Instance("Part");
	const [r, g, b] = ORES[ore].color;
	part.Color = Color3.fromRGB(r, g, b);
	part.Material = Enum.Material.Metal;
	part.Size = new Vector3(FALLBACK_SIZE, FALLBACK_SIZE, FALLBACK_SIZE);
	part.PivotOffset = new CFrame(0, -FALLBACK_SIZE / 2, 0);
	part.Parent = model;
	model.PrimaryPart = part;
	return model;
}

/** A clone that only shows: anchored, not touchable, not hit by clicks, rays or the camera. */
function makeVisualOnly(model: Model): void {
	for (const part of model.GetDescendants()) {
		if (part.IsA("BasePart")) {
			part.Anchored = true;
			part.CanCollide = false;
			part.CanTouch = false;
			part.CanQuery = false;
			part.CastShadow = false;
		} else if (part.IsA("Script") || part.IsA("LocalScript") || part.IsA("ProximityPrompt")) {
			part.Destroy();
		}
	}
}

function takeModel(ore: OreId, stage: number): Model {
	const key = `${ore}:${stage}`;
	const free = pool.get(key);
	const reused = free?.pop();
	if (reused !== undefined) {
		return reused;
	}
	const template = findTemplate(ore, stage);
	const model = template !== undefined ? template.Clone() : fallbackModel(ore);
	makeVisualOnly(model);
	return model;
}

function releaseModel(key: string, model: Model): void {
	model.Parent = undefined;
	let free = pool.get(key);
	if (free === undefined) {
		free = [];
		pool.set(key, free);
	}
	free.push(model);
}

// ---- rides ----

function startRide(ore: OreId, stage: number, points: ReadonlyArray<Vector3>, wait: number, maxSeconds: number): void {
	if (points.size() < 2 || rides.size() >= MAX_ACTIVE_ITEMS) {
		return;
	}
	const lengths = [0];
	for (let i = 1; i < points.size(); i++) {
		lengths.push(lengths[i - 1] + points[i].sub(points[i - 1]).Magnitude);
	}
	const total = lengths[lengths.size() - 1];
	if (total <= 0) {
		return;
	}
	const model = takeModel(ore, stage);
	model.PivotTo(new CFrame(points[0]));
	rides.push({
		key: `${ore}:${stage}`,
		model,
		points,
		lengths,
		// Arrive about when the next machine takes the item (the server moves it into that queue at once), so the
		// machine never fills up while nothing is seen arriving (feedback 2026-11-26).
		speed: math.max(ITEM_SPEED, total / math.clamp(maxSeconds, MIN_RIDE_SECONDS, MAX_RIDE_SECONDS)),
		wait,
		travelled: 0,
		segment: 1,
	});
}

/** Moves one ride; returns false when it has arrived. */
function stepRide(ride: Ride, dt: number): boolean {
	if (ride.wait > 0) {
		ride.wait -= dt;
		return true;
	}
	if (ride.model.Parent === undefined) {
		ride.model.Parent = getItemsFolder();
	}
	ride.travelled += ride.speed * dt;
	const total = ride.lengths[ride.lengths.size() - 1];
	if (ride.travelled >= total) {
		return false;
	}
	while (ride.segment < ride.lengths.size() - 1 && ride.lengths[ride.segment] < ride.travelled) {
		ride.segment++;
	}
	const segment = ride.segment;
	const from = ride.points[segment - 1];
	const to = ride.points[segment];
	const span = ride.lengths[segment] - ride.lengths[segment - 1];
	const alpha = span > 0 ? (ride.travelled - ride.lengths[segment - 1]) / span : 1;
	const position = from.Lerp(to, alpha);
	const flatTarget = new Vector3(to.X, position.Y, to.Z);
	const facing =
		flatTarget.sub(position).Magnitude > 0.01 ? CFrame.lookAt(position, flatTarget) : new CFrame(position);
	ride.model.PivotTo(facing);
	return true;
}

function onHeartbeat(dt: number): void {
	for (let i = rides.size() - 1; i >= 0; i--) {
		const ride = rides[i];
		const [ok, moving] = pcall(() => stepRide(ride, dt));
		if (!ok || !moving) {
			rides.remove(i);
			releaseModel(ride.key, ride.model);
		}
	}
}

// ---- server messages ----

function isNearCamera(point: Vector3): boolean {
	const camera = Workspace.CurrentCamera;
	return camera !== undefined && camera.CFrame.Position.sub(point).Magnitude <= VISIBLE_DISTANCE;
}

function onFlow(plotIndex: unknown, flat: unknown): void {
	if (!typeIs(plotIndex, "number") || !typeIs(flat, "table")) {
		return;
	}
	// With streaming, a far plot may not exist on this client yet: then it simply shows nothing.
	const factory = findPlot(plotIndex)?.FindFirstChild(PLOTS.Factory);
	if (factory === undefined) {
		return;
	}
	const path = beltPathOf(plotIndex, factory);
	if (path === undefined) {
		return;
	}
	const owned = ownedMachines(factory);
	const moves = flat as Array<unknown>;
	const leftFrom = new Map<number, number>();
	for (let i = 0; i + 1 < moves.size(); i += 2) {
		const oreIndex = moves[i];
		const from = moves[i + 1];
		if (!typeIs(oreIndex, "number") || !typeIs(from, "number")) {
			continue;
		}
		const ore = ORE_IDS[oreIndex];
		const route = ore !== undefined ? routeFor(path, from, owned) : undefined;
		if (ore === undefined || route === undefined) {
			continue;
		}
		const points = pathBetween(path.points, route.start, route.target).map((p) => new Vector3(p.x, p.y, p.z));
		// Visible when the camera is near either end of THIS ride: the belt is long, its start may be far away.
		if (points.size() < 2 || (!isNearCamera(points[0]) && !isNearCamera(points[points.size() - 1]))) {
			continue;
		}
		// The machine the item rides to (index = its stage); the SellStation has no wait, a short ride is fine.
		const nextMachine = LINE_MACHINES[route.stage];
		const maxSeconds = route.stage < owned && nextMachine !== undefined ? nextMachine.seconds : SELL_RIDE_SECONDS;
		const earlier = leftFrom.get(from) ?? 0;
		leftFrom.set(from, earlier + 1);
		startRide(ore, route.stage, points, earlier * ITEM_GAP_SECONDS, maxSeconds);
	}
}

export function startBeltVisuals(): void {
	onServerUnreliable(LINE_FLOW_REMOTE, onFlow);
	RunService.Heartbeat.Connect(onHeartbeat);
}
