// Physical gear shops (decision 058). The map author places stands tagged Shop with a ShopSlot attribute. Until the map
// has any, the server builds three simple stands (pickaxes, bags, shoes) next to the surface point or in the middle of
// the plots, so the game is playable on every map. As soon as one real Shop exists, no stand is built.
import { CollectionService, Workspace } from "@rbxts/services";
import { ATTRIBUTES, PLOTS, TAGS } from "shared/config/map-contract";
import { Text, text } from "shared/features/i18n";
import { GearSlot } from "shared/features/upgrades";
import { getInstancePosition } from "server/lib/proximity";
import { localizeLabel } from "server/lib/localized";

interface StandDef {
	readonly slot: GearSlot;
	readonly title: Text;
	readonly color: Color3;
}

const STANDS: ReadonlyArray<StandDef> = [
	{ slot: "pickaxe", title: text("shop.stand.pickaxe"), color: Color3.fromRGB(255, 170, 60) },
	{ slot: "bag", title: text("shop.stand.bag"), color: Color3.fromRGB(120, 200, 90) },
	{ slot: "shoes", title: text("shop.stand.shoes"), color: Color3.fromRGB(80, 170, 255) },
];

/** Studs between two stands. */
const STAND_GAP = 14;

function realShopExists(): boolean {
	return CollectionService.GetTagged(TAGS.Shop).some((shop) => shop.IsDescendantOf(Workspace));
}

/** Where the stands go: next to the surface travel point, else the middle of all plots, else the world origin. */
function standCentre(): Vector3 {
	for (const spawn of CollectionService.GetTagged(TAGS.SurfaceSpawn)) {
		const position = spawn.IsDescendantOf(Workspace) ? getInstancePosition(spawn) : undefined;
		if (position !== undefined) {
			return position.add(new Vector3(0, 0, 20));
		}
	}
	const plots = Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(PLOTS.PlotsFolder);
	if (plots !== undefined) {
		let sum = Vector3.zero;
		let count = 0;
		for (const plot of plots.GetChildren()) {
			if (plot.IsA("Model")) {
				sum = sum.add(plot.GetPivot().Position);
				count += 1;
			}
		}
		if (count > 0) {
			return sum.div(count);
		}
	}
	return new Vector3(0, 0, 30);
}

/** The ground under a point (a ray straight down), so a stand never floats or sinks. */
function groundAt(position: Vector3): Vector3 {
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	const hit = Workspace.Raycast(position.add(new Vector3(0, 80, 0)), new Vector3(0, -200, 0), params);
	return hit !== undefined ? hit.Position : position;
}

function buildStand(parent: Instance, def: StandDef, at: Vector3): void {
	const model = new Instance("Model");
	model.Name = `GearShop_${def.slot}`;
	const counter = new Instance("Part");
	counter.Name = "Counter";
	counter.Anchored = true;
	counter.Size = new Vector3(8, 3, 4);
	counter.Color = def.color;
	counter.Material = Enum.Material.Wood;
	counter.Position = at.add(new Vector3(0, 1.5, 0));
	counter.Parent = model;
	const sign = new Instance("Part");
	sign.Name = "Sign";
	sign.Anchored = true;
	sign.CanCollide = false;
	sign.Size = new Vector3(8, 2.5, 0.4);
	sign.Color = Color3.fromRGB(40, 28, 20);
	sign.Position = at.add(new Vector3(0, 6.5, -1.8));
	sign.Parent = model;
	const billboard = new Instance("BillboardGui");
	billboard.Size = new UDim2(0, 220, 0, 50);
	billboard.StudsOffset = new Vector3(0, 2.2, 0);
	billboard.MaxDistance = 120;
	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.TextScaled = true;
	label.Font = Enum.Font.FredokaOne;
	label.TextColor3 = new Color3(1, 1, 1);
	label.TextStrokeTransparency = 0.2;
	label.Parent = billboard;
	billboard.Parent = sign;
	localizeLabel(label, def.title);
	model.PrimaryPart = counter;
	model.SetAttribute(ATTRIBUTES.ShopSlot, def.slot);
	model.Parent = parent;
	CollectionService.AddTag(model, TAGS.Shop);
}

/** Builds the three fallback stands when the map has no Shop of its own. */
export function ensureGearShops(): void {
	if (realShopExists()) {
		return;
	}
	const folder = new Instance("Folder");
	folder.Name = "GearShops";
	folder.Parent = Workspace;
	const centre = standCentre();
	STANDS.forEach((def, index) => {
		const offset = new Vector3((index - 1) * STAND_GAP, 0, 0);
		buildStand(folder, def, groundAt(centre.add(offset)));
	});
}
