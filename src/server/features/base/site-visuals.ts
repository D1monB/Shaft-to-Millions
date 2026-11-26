// How the buildings look on a plot (decision 063). Built from parts until the map author makes models: a model in
// ServerStorage.BuildingTemplates/<buildingId> is used instead when present. Free spots on the plot are found at
// runtime with a box query, so a building never lands inside the factory, terminals or fences.
import { CollectionService, Players, ServerStorage, Workspace } from "@rbxts/services";
import { BUILDINGS, BUILDING_IDS, BuildingId } from "shared/config/base";
import { BASE_SITE_ID_ATTRIBUTE, BASE_SITE_TAG } from "shared/features/base";
import { Text, nameKeys, ref, text } from "shared/features/i18n";
import { formatDuration } from "shared/lib/format";
import { PlotAreaInfo } from "server/features/line";
import { localizeLabel } from "server/lib/localized";
import { ensurePrompt } from "server/lib/proximity";

const TEMPLATES_FOLDER = "BuildingTemplates";
/** Side of one building plot, studs. */
const PAD = 22;
/** How far from the plot centre spots are searched (the map's plots are 360 x 360). */
const REACH = 150;
const SPOT_STEP = 40;

export type PlotArea = PlotAreaInfo;

/** Studs a building keeps from every machine slot, bought or not. */
const SLOT_CLEARANCE = 30;

export interface Site {
	readonly id: BuildingId;
	readonly model: Model;
	readonly ground: CFrame;
	/** What the model shows now, so it is only rebuilt when it changes. */
	shown?: string;
}

function isIgnored(instance: Instance, area: PlotArea): boolean {
	if (instance === area.base || instance.IsA("Terrain")) {
		return true;
	}
	return Players.GetPlayers().some(
		(player) => player.Character !== undefined && instance.IsDescendantOf(player.Character),
	);
}

function isFree(area: PlotArea, ground: CFrame): boolean {
	const params = new OverlapParams();
	params.MaxParts = 40;
	const parts = Workspace.GetPartBoundsInBox(
		ground.mul(new CFrame(0, 9, 0)),
		new Vector3(PAD + 4, 14, PAD + 4),
		params,
	);
	return parts.every((found) => isIgnored(found, area));
}

/** One free spot per building, nearest to the owner's spawn first. Falls back to the plot's edge when crowded. */
export function findSpots(area: PlotArea): CFrame[] {
	const top = area.base.CFrame.mul(new CFrame(0, area.base.Size.Y / 2, 0));
	const candidates: CFrame[] = [];
	for (let x = -REACH; x <= REACH; x += SPOT_STEP) {
		for (let z = -REACH; z <= REACH; z += SPOT_STEP) {
			candidates.push(top.mul(new CFrame(x, 0, z)));
		}
	}
	candidates.sort((a, b) => a.Position.sub(area.spawn).Magnitude < b.Position.sub(area.spawn).Magnitude);
	const spots: CFrame[] = [];
	for (const candidate of candidates) {
		const farEnough = candidate.Position.sub(area.spawn).Magnitude > 20;
		const offSlots = area.reserved.every(
			(slot) =>
				new Vector3(slot.X - candidate.Position.X, 0, slot.Z - candidate.Position.Z).Magnitude > SLOT_CLEARANCE,
		);
		if (spots.size() < BUILDING_IDS.size() && farEnough && offSlots && isFree(area, candidate)) {
			spots.push(candidate);
		}
	}
	// A crowded plot: line the rest up along the edge, so every building still exists.
	while (spots.size() < BUILDING_IDS.size()) {
		spots.push(top.mul(new CFrame(-REACH + spots.size() * SPOT_STEP, 0, REACH + 10)));
	}
	return spots;
}

function part(model: Model, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material): Part {
	const block = new Instance("Part");
	block.Anchored = true;
	block.Size = size;
	block.CFrame = cframe;
	block.Color = color;
	block.Material = material;
	block.TopSurface = Enum.SurfaceType.Smooth;
	block.BottomSurface = Enum.SurfaceType.Smooth;
	block.Parent = model;
	return block;
}

function rgb(color: readonly [number, number, number]): Color3 {
	return Color3.fromRGB(color[0], color[1], color[2]);
}

/** The finished house: it grows with its level (taller, more lit windows, a flag from level 4). */
function house(model: Model, ground: CFrame, id: BuildingId, level: number): void {
	const template = ServerStorage.FindFirstChild(TEMPLATES_FOLDER)?.FindFirstChild(id);
	if (template !== undefined && template.IsA("Model")) {
		const copy = template.Clone();
		copy.PivotTo(ground.mul(new CFrame(0, copy.GetExtentsSize().Y / 2, 0)));
		copy.Parent = model;
		return;
	}
	const accent = rgb(BUILDINGS[id].color);
	const height = 6 + level * 1.5;
	const width = 12 + math.min(level, 4);
	part(
		model,
		new Vector3(width, height, width - 2),
		ground.mul(new CFrame(0, height / 2 + 0.8, 0)),
		Color3.fromRGB(214, 190, 150),
		Enum.Material.WoodPlanks,
	);
	part(
		model,
		new Vector3(width + 2, 1, width),
		ground.mul(new CFrame(0, height + 1.3, 0)),
		accent,
		Enum.Material.SmoothPlastic,
	);
	part(
		model,
		new Vector3(width - 4, 1.6, width - 6),
		ground.mul(new CFrame(0, height + 2.6, 0)),
		accent,
		Enum.Material.SmoothPlastic,
	);
	part(
		model,
		new Vector3(3, 4.4, 0.4),
		ground.mul(new CFrame(0, 3, -(width - 2) / 2 - 0.1)),
		Color3.fromRGB(80, 52, 32),
		Enum.Material.Wood,
	);
	for (let i = 0; i < level; i++) {
		const side = i % 2 === 0 ? -1 : 1;
		const y = 3.4 + math.floor(i / 2) * 2.8;
		part(
			model,
			new Vector3(2.2, 1.6, 0.3),
			ground.mul(new CFrame(side * (width / 2 - 2.4), y, -(width - 2) / 2 - 0.15)),
			Color3.fromRGB(255, 225, 140),
			Enum.Material.Neon,
		);
	}
	if (level >= 4) {
		part(
			model,
			new Vector3(0.3, 6, 0.3),
			ground.mul(new CFrame(width / 2 - 1, height + 4.5, 0)),
			Color3.fromRGB(90, 90, 96),
			Enum.Material.Metal,
		);
		part(
			model,
			new Vector3(3, 1.8, 0.2),
			ground.mul(new CFrame(width / 2 - 2.6, height + 6.4, 0)),
			accent,
			Enum.Material.Fabric,
		);
	}
}

/** Scaffolding around a building under construction. */
function scaffold(model: Model, ground: CFrame): void {
	const wood = Color3.fromRGB(160, 118, 70);
	for (const x of [-8, 8]) {
		for (const z of [-7, 7]) {
			part(model, new Vector3(0.8, 12, 0.8), ground.mul(new CFrame(x, 6.8, z)), wood, Enum.Material.Wood);
		}
	}
	for (const y of [5, 11.6]) {
		for (const z of [-7, 7]) {
			part(model, new Vector3(17, 0.5, 1.6), ground.mul(new CFrame(0, y, z)), wood, Enum.Material.WoodPlanks);
		}
	}
	part(
		model,
		new Vector3(4, 3, 4),
		ground.mul(new CFrame(-3, 2.3, 0)),
		Color3.fromRGB(150, 150, 156),
		Enum.Material.Concrete,
	);
	part(model, new Vector3(3, 2, 6), ground.mul(new CFrame(3, 1.8, 1)), wood, Enum.Material.WoodPlanks);
}

function labelGui(adornee: BasePart): TextLabel {
	const billboard = new Instance("BillboardGui");
	billboard.Name = "SiteInfo";
	billboard.Size = UDim2.fromOffset(240, 56);
	billboard.StudsOffsetWorldSpace = new Vector3(0, 18, 0);
	billboard.MaxDistance = 140;
	const label = new Instance("TextLabel");
	label.Name = "Info";
	label.BackgroundTransparency = 1;
	label.Size = UDim2.fromScale(1, 1);
	label.Font = Enum.Font.FredokaOne;
	label.TextScaled = true;
	label.TextColor3 = new Color3(1, 1, 1);
	label.TextStrokeTransparency = 0.15;
	label.Parent = billboard;
	billboard.Parent = adornee;
	return label;
}

function infoText(id: BuildingId, level: number, left: number | undefined): Text {
	const name = ref(nameKeys.building(id));
	if (left !== undefined) {
		return text("base.siteBuilding", { name, time: formatDuration(left) });
	}
	return level === 0 ? text("base.siteEmpty", { name }) : text("base.siteLevel", { name, level });
}

/** Draws a site for its level and build timer. Rebuilds only when the look changes; the timer text updates. */
export function drawSite(site: Site, level: number, left: number | undefined): void {
	const look = `${level}:${left !== undefined ? "building" : "idle"}`;
	let pad = site.model.PrimaryPart;
	if (site.shown !== look || pad === undefined) {
		site.shown = look;
		site.model.ClearAllChildren();
		pad = part(
			site.model,
			new Vector3(PAD, 0.8, PAD),
			site.ground.mul(new CFrame(0, 0.3, 0)),
			Color3.fromRGB(125, 118, 108),
			Enum.Material.Cobblestone,
		);
		pad.Name = "Pad";
		site.model.PrimaryPart = pad;
		if (level > 0) {
			house(site.model, site.ground, site.id, level);
		}
		if (left !== undefined) {
			scaffold(site.model, site.ground);
		}
		labelGui(pad);
		ensurePrompt(site.model, text("common.open"), text("base.title"), 14);
	}
	const label = pad.FindFirstChild("Info", true);
	if (label !== undefined && label.IsA("TextLabel")) {
		localizeLabel(label, infoText(site.id, level, left));
	}
}

export function createSite(parent: Instance, id: BuildingId, ground: CFrame): Site {
	const model = new Instance("Model");
	model.Name = `Building_${id}`;
	model.SetAttribute(BASE_SITE_ID_ATTRIBUTE, id);
	model.Parent = parent;
	CollectionService.AddTag(model, BASE_SITE_TAG);
	return { id, model, ground };
}
