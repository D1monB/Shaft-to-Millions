// Grey-box test area, built ONLY in Studio and ONLY for tags the real map does not have yet.
// Why: the developer can play-test every system before the map author delivers models, and as soon as a
// real tagged model exists, its placeholder is no longer built. Nothing here ships to live servers.
import { CollectionService, RunService, Workspace } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
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
		buildOreRow(new Vector3(10, 0, 20), [
			["coal", 4],
			["copper", 3],
			["iron", 3],
			["quartz", 1],
		]);
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
