// Grey-box test area, built ONLY in Studio and ONLY for tags the real map does not have yet.
// Why: the developer can play-test every system before the map author delivers models, and as soon as a
// real tagged model exists, its placeholder is no longer built. Nothing here ships to live servers.
import { CollectionService, RunService, Workspace } from "@rbxts/services";
import { ATTRIBUTES, PLOTS, PLOT_ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { ORES, OreId } from "shared/config/ores";

let folder: Folder | undefined;

function getFolder(): Folder {
	if (folder === undefined) {
		folder = new Instance("Folder");
		folder.Name = "DevPlaceholders";
		folder.Parent = Workspace;
	}
	return folder;
}

function makeLabel(part: BasePart, text: string): void {
	const billboard = new Instance("BillboardGui");
	billboard.Size = new UDim2(0, 200, 0, 40);
	billboard.StudsOffset = new Vector3(0, part.Size.Y / 2 + 2, 0);
	billboard.AlwaysOnTop = true;
	billboard.MaxDistance = 80;
	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.TextScaled = true;
	label.Font = Enum.Font.GothamBold;
	label.TextColor3 = new Color3(1, 1, 1);
	label.TextStrokeTransparency = 0.3;
	label.Text = text;
	label.Parent = billboard;
	billboard.Parent = part;
}

export interface PlaceholderOptions {
	readonly name: string;
	readonly size: Vector3;
	readonly position: Vector3;
	readonly color: Color3;
	readonly tag?: string;
	readonly attributes?: Record<string, string | number>;
	readonly label?: string;
	readonly material?: Enum.Material;
	readonly transparent?: boolean;
}

export function makePlaceholder(options: PlaceholderOptions): Part {
	const part = new Instance("Part");
	part.Name = options.name;
	part.Anchored = true;
	part.Size = options.size;
	part.Position = options.position;
	part.Color = options.color;
	part.Material = options.material ?? Enum.Material.SmoothPlastic;
	if (options.transparent === true) {
		part.Transparency = 0.6;
		part.CanCollide = false;
	}
	if (options.attributes !== undefined) {
		for (const [key, value] of pairs(options.attributes)) {
			part.SetAttribute(key, value);
		}
	}
	if (options.label !== undefined) {
		makeLabel(part, options.label);
	}
	part.Parent = getFolder();
	if (options.tag !== undefined) {
		CollectionService.AddTag(part, options.tag);
	}
	return part;
}

/** True when placeholders for `tag` should be built: in Studio, and the map has none of its own. */
export function needsPlaceholders(tag: string): boolean {
	return RunService.IsStudio() && CollectionService.GetTagged(tag).size() === 0;
}

function rgb(color: readonly [number, number, number]): Color3 {
	return Color3.fromRGB(color[0], color[1], color[2]);
}

/** A row of ore nodes for one layer, starting at `origin`. */
export function buildOreRow(origin: Vector3, ores: ReadonlyArray<[OreId, number]>): void {
	let x = 0;
	for (const [oreId, count] of ores) {
		for (let i = 0; i < count; i++) {
			makePlaceholder({
				name: `Ore_${oreId}`,
				size: new Vector3(4, 4, 4),
				position: origin.add(new Vector3(x, 2, (i % 2) * 6)),
				color: rgb(ORES[oreId].color),
				material: Enum.Material.Slate,
				tag: TAGS.OreNode,
				attributes: { [ATTRIBUTES.OreId]: oreId },
			});
			x += 6;
		}
	}
}

/** Builds the surface + layer 1 test area. Called once on server start. */
export function buildBasePlaceholders(): void {
	if (needsPlaceholders(TAGS.OreNode)) {
		makePlaceholder({
			name: "TestFloor",
			size: new Vector3(160, 1, 120),
			position: new Vector3(40, -0.5, 0),
			color: Color3.fromRGB(90, 90, 95),
			material: Enum.Material.Slate,
		});
		buildOreRow(new Vector3(10, 0, 20), [["copper", 6]]);
	}
	if (needsPlaceholders(TAGS.SurfaceSpawn)) {
		makePlaceholder({
			name: "SurfaceSpawn",
			size: new Vector3(6, 1, 6),
			position: new Vector3(0, 0.5, -10),
			color: Color3.fromRGB(120, 170, 255),
			tag: TAGS.SurfaceSpawn,
			label: "Поверхня (швидка подорож)",
		});
	}
	if (needsPlaceholders(TAGS.Shop)) {
		makePlaceholder({
			name: "Shop",
			size: new Vector3(8, 8, 2),
			position: new Vector3(-10, 4, -20),
			color: Color3.fromRGB(240, 180, 60),
			tag: TAGS.Shop,
			label: "Магазин спорядження",
		});
	}
	if (needsPlaceholders(TAGS.SellZone)) {
		makePlaceholder({
			name: "SellZone",
			size: new Vector3(10, 6, 10),
			position: new Vector3(-10, 3, 0),
			color: Color3.fromRGB(90, 200, 120),
			tag: TAGS.SellZone,
			label: "Скупка руди",
			transparent: true,
		});
	}
}

function makeCamp(layer: number, position: Vector3): void {
	const camp = new Instance("SpawnLocation");
	camp.Name = `Camp_${layer}`;
	camp.Anchored = true;
	camp.Neutral = true;
	camp.Duration = 0; // no spawn force field: the mine is not a PvP zone
	camp.Size = new Vector3(8, 1, 8);
	camp.Position = position;
	camp.Color = Color3.fromRGB(80, 160, 255);
	camp.SetAttribute(ATTRIBUTES.LayerId, layer);
	makeLabel(camp, `Табір шару ${layer}`);
	camp.Parent = getFolder();
	CollectionService.AddTag(camp, TAGS.CampSpawn);
}

/**
 * Test layers 2 to 5 next to layer 1 (in the real map they are deeper, here they are just further away),
 * with a camp per layer and a drill site per layer. Walk to camp 2, then 3, 4 and 5, to open the layers.
 */
export function buildLayerPlaceholders(): void {
	if (needsPlaceholders(TAGS.CampSpawn)) {
		makePlaceholder({
			name: "DeepFloor",
			size: new Vector3(160, 1, 200),
			position: new Vector3(40, -0.5, 160),
			color: Color3.fromRGB(70, 55, 50),
			material: Enum.Material.Basalt,
		});
		makeCamp(1, new Vector3(0, 0.5, 40));
		makeCamp(2, new Vector3(0, 0.5, 80));
		makeCamp(3, new Vector3(0, 0.5, 120));
		makeCamp(4, new Vector3(0, 0.5, 160));
		makeCamp(5, new Vector3(0, 0.5, 200));
		buildOreRow(new Vector3(10, 0, 80), [["iron", 4]]);
		buildOreRow(new Vector3(10, 0, 120), [["gold", 4]]);
		buildOreRow(new Vector3(10, 0, 160), [["titanium", 4]]);
		buildOreRow(new Vector3(10, 0, 200), [
			["obsidian", 3],
			["etherium", 1],
		]);
	}
	if (needsPlaceholders(TAGS.DrillSite)) {
		for (const [layer, z] of [
			[1, 40],
			[2, 80],
			[3, 120],
			[4, 160],
			[5, 200],
		] as const) {
			makePlaceholder({
				name: `DrillSite_${layer}`,
				size: new Vector3(5, 7, 5),
				position: new Vector3(-12, 3.5, z),
				color: Color3.fromRGB(230, 200, 60),
				material: Enum.Material.DiamondPlate,
				tag: TAGS.DrillSite,
				attributes: { [ATTRIBUTES.LayerId]: layer },
				label: `Автобур ${layer}`,
			});
		}
	}
}

/** Three chest stands near the shop. */
export function buildChestPlaceholders(): void {
	if (!needsPlaceholders(TAGS.Chest)) {
		return;
	}
	const chests: ReadonlyArray<[string, string, Color3]> = [
		["pet_chest", "Скриня улюбленців", Color3.fromRGB(255, 140, 180)],
		["speed_chest", "Скриня швидкості", Color3.fromRGB(80, 200, 255)],
		["pickaxe_chest", "Скриня кирки", Color3.fromRGB(255, 170, 60)],
	];
	chests.forEach(([chestId, label, color], index) => {
		makePlaceholder({
			name: `Chest_${chestId}`,
			size: new Vector3(4, 3, 3),
			position: new Vector3(10 + index * 8, 1.5, -25),
			color,
			material: Enum.Material.Wood,
			tag: TAGS.Chest,
			attributes: { [ATTRIBUTES.ChestId]: chestId },
			label,
		});
	});
}

/** A grey-box machine: a Model with one labelled box, the Stage attribute and a primary part. */
function makeMachineBox(parent: Instance, stage: number, position: Vector3): void {
	const model = new Instance("Model");
	model.Name = `${stage < 10 ? "0" : ""}${stage}_Machine`;
	const box = new Instance("Part");
	box.Name = "Frame";
	box.Anchored = true;
	box.Size = new Vector3(6, 6, 6);
	box.Position = position;
	box.Color = Color3.fromHSV(stage / 12, 0.5, 0.9);
	box.Material = Enum.Material.SmoothPlastic;
	box.Parent = model;
	makeLabel(box, `Машина ${stage}`);
	model.PrimaryPart = box;
	model.SetAttribute(PLOT_ATTRIBUTES.Stage, stage);
	model.Parent = parent;
}

/** A plot like the map author's: Base, Factory/Machines (12 boxes) and Factory/Conveyors, or only a Base. */
function makePlot(plotsFolder: Folder, index: number, origin: Vector3, withFactory: boolean): void {
	const plot = new Instance("Model");
	plot.Name = `Plot${index}`;
	plot.SetAttribute(PLOT_ATTRIBUTES.Owner, 0);
	plot.SetAttribute(PLOT_ATTRIBUTES.PlotIndex, index);
	const base = new Instance("Part");
	base.Name = PLOTS.Base;
	base.Anchored = true;
	base.Size = new Vector3(90, 1, 30);
	base.Position = origin;
	base.Color = Color3.fromRGB(120, 90, 70);
	base.Parent = plot;
	plot.PrimaryPart = base;
	if (withFactory) {
		const factory = new Instance("Folder");
		factory.Name = PLOTS.Factory;
		const machines = new Instance("Folder");
		machines.Name = PLOTS.Machines;
		machines.Parent = factory;
		const conveyors = new Instance("Folder");
		conveyors.Name = PLOTS.Conveyors;
		conveyors.Parent = factory;
		for (let stage = 1; stage <= 12; stage++) {
			makeMachineBox(machines, stage, origin.add(new Vector3(-41 + (stage - 1) * 7.5, 3.5, 0)));
		}
		const belt = new Instance("Part");
		belt.Name = "Conveyor_Straight";
		belt.Anchored = true;
		belt.Size = new Vector3(86, 0.4, 3);
		belt.Position = origin.add(new Vector3(0, 0.7, 6));
		belt.Color = Color3.fromRGB(60, 60, 65);
		belt.SetAttribute("ConveyorFlow", 1);
		belt.Parent = conveyors;
		factory.Parent = plot;
	}
	plot.Parent = plotsFolder;
}

/**
 * Two test plots when the place has no Map/Plots (our own test place): the first with a full grey-box factory, the
 * second with only a Base, so the runtime copy of the factory is tested too.
 */
export function buildPlotPlaceholders(): void {
	if (
		!RunService.IsStudio() ||
		Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(PLOTS.PlotsFolder) !== undefined
	) {
		return;
	}
	let map = Workspace.FindFirstChild(PLOTS.MapFolder);
	if (map === undefined) {
		map = new Instance("Folder");
		map.Name = PLOTS.MapFolder;
		map.Parent = Workspace;
	}
	const plotsFolder = new Instance("Folder");
	plotsFolder.Name = PLOTS.PlotsFolder;
	plotsFolder.Parent = map;
	makePlot(plotsFolder, 1, new Vector3(-80, 0.5, -60), true);
	makePlot(plotsFolder, 2, new Vector3(-80, 0.5, -100), false);
}
