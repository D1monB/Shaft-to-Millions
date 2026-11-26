// Physical gear shops (decision 058, rebuilt in 061): three separate shop buildings (pickaxes, bags, shoes) in a
// market district next to the map's SpawnLocation. The map author may place real shops tagged Shop with a ShopSlot
// attribute; a slot with a real shop gets no built one. A Shop WITHOUT ShopSlot sells everything and replaces nothing,
// so a stray old shop part can never silently remove the three departments again.
import { CollectionService, Players, ServerStorage, Workspace } from "@rbxts/services";
import { ATTRIBUTES, PLOTS, TAGS } from "shared/config/map-contract";
import { PICKAXES } from "shared/config/pickaxes";
import { Text, text } from "shared/features/i18n";
import { GearSlot, PICKAXE_TEMPLATES_FOLDER, isGearSlot } from "shared/features/upgrades";
import { localizeLabel } from "server/lib/localized";
import { buildShopDecor } from "./shop-decor";

interface ShopLook {
	readonly slot: GearSlot;
	readonly title: Text;
	readonly subtitle: Text;
	readonly accent: Color3;
	readonly wall: Color3;
}

const SHOPS: ReadonlyArray<ShopLook> = [
	{
		slot: "pickaxe",
		title: text("shop.stand.pickaxe"),
		subtitle: text("shop.sub.pickaxe"),
		accent: Color3.fromRGB(255, 150, 40),
		wall: Color3.fromRGB(92, 62, 44),
	},
	{
		slot: "bag",
		title: text("shop.stand.bag"),
		subtitle: text("shop.sub.bag"),
		accent: Color3.fromRGB(96, 200, 90),
		wall: Color3.fromRGB(58, 80, 54),
	},
	{
		slot: "shoes",
		title: text("shop.stand.shoes"),
		subtitle: text("shop.sub.shoes"),
		accent: Color3.fromRGB(70, 165, 255),
		wall: Color3.fromRGB(46, 62, 92),
	},
];

/** Studs between the middles of two shops: far enough that each is its own place. */
const SHOP_GAP = 46;
/** The district sits this far in front of the SpawnLocation (toward the mine). */
const DISTRICT_FORWARD = 40;

let district = new Vector3(0, 5, 400);

/** Where fast travel to the shops puts the player: in front of the middle shop. */
export function shopDistrictPosition(): Vector3 {
	return district;
}

/** The slots a real, map-made shop already covers. */
function coveredSlots(): Set<GearSlot> {
	const covered = new Set<GearSlot>();
	for (const shop of CollectionService.GetTagged(TAGS.Shop)) {
		const slot = shop.GetAttribute(ATTRIBUTES.ShopSlot);
		if (shop.IsDescendantOf(Workspace) && isGearSlot(slot)) {
			covered.add(slot);
		}
	}
	return covered;
}

/** The middle of the district and the direction its shops face: in front of the SpawnLocation, else between plots. */
function districtFrame(): CFrame {
	const spawn = Workspace.FindFirstChildWhichIsA("SpawnLocation", true);
	if (spawn !== undefined) {
		const flat = new Vector3(spawn.Position.X, 0, spawn.Position.Z);
		const toMine = flat.Magnitude > 1 ? flat.Unit.mul(-1) : new Vector3(0, 0, -1);
		const centre = spawn.Position.add(toMine.mul(DISTRICT_FORWARD));
		// -Z of the frame (its front) looks back at the spawn, so a new player sees every shop front.
		return CFrame.lookAt(centre, centre.sub(toMine));
	}
	const plots = Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(PLOTS.PlotsFolder);
	const first = plots?.GetChildren().find((child): child is Model => child.IsA("Model"));
	const centre = first !== undefined ? first.GetPivot().Position.mul(0.7) : new Vector3(0, 5, 40);
	return CFrame.lookAt(centre, centre.add(new Vector3(0, 0, 1)));
}

/** The ground under a point (a ray straight down, ignoring characters), so a shop never floats or sinks. */
function groundHeight(position: Vector3): number {
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	const characters: Instance[] = [];
	for (const player of Players.GetPlayers()) {
		if (player.Character !== undefined) {
			characters.push(player.Character);
		}
	}
	params.FilterDescendantsInstances = characters;
	const hit = Workspace.Raycast(position.add(new Vector3(0, 60, 0)), new Vector3(0, -200, 0), params);
	return hit !== undefined ? hit.Position.Y : position.Y;
}

function part(model: Model, name: string, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material): Part {
	const block = new Instance("Part");
	block.Name = name;
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

/** A big sign painted on a board (both texts localized per viewer). */
function sign(model: Model, at: CFrame, look: ShopLook): void {
	const board = part(
		model,
		"SignBoard",
		new Vector3(18, 4.6, 0.6),
		at,
		Color3.fromRGB(28, 20, 14),
		Enum.Material.Wood,
	);
	const gui = new Instance("SurfaceGui");
	gui.Face = Enum.NormalId.Front;
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	gui.PixelsPerStud = 40;
	gui.LightInfluence = 0.2;
	gui.Parent = board;
	const makeLabel = (name: string, y: number, height: number, color: Color3, value: Text) => {
		const label = new Instance("TextLabel");
		label.Name = name;
		label.BackgroundTransparency = 1;
		label.Position = UDim2.fromScale(0.03, y);
		label.Size = UDim2.fromScale(0.94, height);
		label.Font = Enum.Font.FredokaOne;
		label.TextScaled = true;
		label.TextColor3 = color;
		label.TextStrokeTransparency = 0.3;
		label.Parent = gui;
		localizeLabel(label, value);
	};
	makeLabel("Title", 0.04, 0.58, look.accent, look.title);
	makeLabel("Subtitle", 0.64, 0.3, new Color3(1, 1, 1), look.subtitle);
}

/** One shop building. Local space: -Z is the front (the counter side), the floor's top is at y = 0. */
function buildShop(parent: Instance, look: ShopLook, origin: CFrame): void {
	const model = new Instance("Model");
	model.Name = `GearShop_${look.slot}`;
	const at = (x: number, y: number, z: number) => origin.mul(new CFrame(x, y, z));

	part(model, "Floor", new Vector3(26, 1, 18), at(0, -0.4, 0), Color3.fromRGB(110, 80, 52), Enum.Material.WoodPlanks);
	part(model, "Trim", new Vector3(27, 0.4, 19), at(0, -0.9, 0), look.accent, Enum.Material.SmoothPlastic);
	// Back wall and side walls; the front stays open.
	part(model, "BackWall", new Vector3(24, 11, 1), at(0, 5.6, 8), look.wall, Enum.Material.Wood);
	part(model, "LeftWall", new Vector3(1, 11, 9), at(-12, 5.6, 3.5), look.wall, Enum.Material.Wood);
	part(model, "RightWall", new Vector3(1, 11, 9), at(12, 5.6, 3.5), look.wall, Enum.Material.Wood);
	for (const x of [-11.5, 11.5]) {
		part(
			model,
			"Post",
			new Vector3(1.2, 11, 1.2),
			at(x, 5.6, -7.5),
			Color3.fromRGB(60, 40, 26),
			Enum.Material.Wood,
		);
		const lamp = part(
			model,
			"Lamp",
			new Vector3(1.4, 1.4, 1.4),
			at(x, 10.4, -8.4),
			look.accent,
			Enum.Material.Neon,
		);
		const light = new Instance("PointLight");
		light.Color = look.accent;
		light.Range = 22;
		light.Brightness = 1.6;
		light.Parent = lamp;
	}
	// A striped awning over the front.
	for (let i = 0; i < 8; i++) {
		const color = i % 2 === 0 ? look.accent : Color3.fromRGB(245, 240, 230);
		const stripe = at(-10.5 + i * 3, 11.1, -8.2).mul(CFrame.Angles(math.rad(-18), 0, 0));
		part(model, "Awning", new Vector3(3, 0.4, 4.5), stripe, color, Enum.Material.Fabric).CanCollide = false;
	}
	part(model, "Roof", new Vector3(27, 0.8, 17), at(0, 12, 0.5), Color3.fromRGB(52, 34, 24), Enum.Material.Wood);
	part(model, "RoofEdge", new Vector3(27.6, 0.5, 17.6), at(0, 12.55, 0.5), look.accent, Enum.Material.SmoothPlastic);
	sign(model, at(0, 15.4, -7.6), look);

	// The counter the player walks up to: the model's PrimaryPart, so the prompt and the distance check sit here.
	const counter = part(
		model,
		"Counter",
		new Vector3(12, 3, 2.4),
		at(0, 1.6, -3.4),
		look.accent,
		Enum.Material.SmoothPlastic,
	);
	part(
		model,
		"CounterTop",
		new Vector3(13, 0.5, 3.2),
		at(0, 3.35, -3.4),
		Color3.fromRGB(44, 30, 20),
		Enum.Material.Wood,
	);
	buildShopDecor(model, look.slot, at, look.accent, pickaxeTemplates());

	model.PrimaryPart = counter;
	model.SetAttribute(ATTRIBUTES.ShopSlot, look.slot);
	model.Parent = parent;
	CollectionService.AddTag(model, TAGS.Shop);
}

/** A few of the map author's pickaxe Tools (weak, middle, best) for the pickaxe shop's wall. */
function pickaxeTemplates(): Instance[] {
	const folder = ServerStorage.FindFirstChild(PICKAXE_TEMPLATES_FOLDER);
	const picks = [PICKAXES[1], PICKAXES[5], PICKAXES[PICKAXES.size() - 1]];
	const found: Instance[] = [];
	for (const def of picks) {
		const tool = folder?.FindFirstChild(def.tool);
		if (tool !== undefined) {
			found.push(tool);
		}
	}
	return found;
}

/** Builds a shop for every slot the map has no shop for. */
export function ensureGearShops(): void {
	const covered = coveredSlots();
	const frame = districtFrame();
	const front = frame.mul(new CFrame(0, 0, -14)).Position;
	district = new Vector3(front.X, groundHeight(front) + 4, front.Z);
	const folder = new Instance("Folder");
	folder.Name = "GearShops";
	folder.Parent = Workspace;
	SHOPS.forEach((look, index) => {
		if (covered.has(look.slot)) {
			return;
		}
		const spot = frame.mul(new CFrame((index - 1) * SHOP_GAP, 0, 0));
		const y = groundHeight(spot.Position) + 0.9;
		const origin = spot.Rotation.add(new Vector3(spot.Position.X, y, spot.Position.Z));
		buildShop(folder, look, origin);
	});
}
