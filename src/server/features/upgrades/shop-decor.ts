// The goods on display in each gear shop (decision 061): pickaxes on the wall, bags and shoes on shelves. Pure looks,
// built from parts and copies of the map author's pickaxe models (scripts removed, anchored, no collisions).
import { GearSlot } from "shared/features/upgrades";

type At = (x: number, y: number, z: number) => CFrame;

function block(model: Model, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material): Part {
	const piece = new Instance("Part");
	piece.Anchored = true;
	piece.CanCollide = false;
	piece.Size = size;
	piece.CFrame = cframe;
	piece.Color = color;
	piece.Material = material;
	piece.TopSurface = Enum.SurfaceType.Smooth;
	piece.BottomSurface = Enum.SurfaceType.Smooth;
	piece.Parent = model;
	return piece;
}

function shelf(model: Model, at: At, y: number): void {
	block(model, new Vector3(20, 0.4, 2.2), at(0, y, 6.4), Color3.fromRGB(150, 108, 68), Enum.Material.WoodPlanks);
}

/** The looks of a pickaxe Tool as a hanging model: parts only, no scripts, sounds or physics. */
function displayPickaxe(model: Model, template: Instance, cframe: CFrame): void {
	const display = new Instance("Model");
	display.Name = "DisplayPickaxe";
	const sources = template.IsA("BasePart") ? [template] : template.GetDescendants();
	for (const source of sources) {
		if (source.IsA("BasePart")) {
			const copy = source.Clone();
			for (const child of copy.GetChildren()) {
				if (!child.IsA("SurfaceAppearance") && !child.IsA("DataModelMesh") && !child.IsA("Decal")) {
					child.Destroy();
				}
			}
			copy.Anchored = true;
			copy.CanCollide = false;
			copy.CanQuery = false;
			copy.Parent = display;
		}
	}
	const [, size] = display.GetBoundingBox();
	const longest = math.max(size.X, size.Y, size.Z);
	if (longest > 0.1) {
		display.ScaleTo(display.GetScale() * (5 / longest));
	}
	display.PivotTo(cframe);
	display.Parent = model;
}

function pickaxeDecor(model: Model, at: At, accent: Color3, pickaxes: ReadonlyArray<Instance>): void {
	shelf(model, at, 3.6);
	pickaxes.forEach((template, index) => {
		const x = (index - (pickaxes.size() - 1) / 2) * 6.4;
		block(model, new Vector3(4.6, 5.4, 0.3), at(x, 6.8, 7.4), Color3.fromRGB(38, 26, 18), Enum.Material.Wood);
		displayPickaxe(model, template, at(x, 6.8, 6.4).mul(CFrame.Angles(0, 0, math.rad(35))));
	});
	// An anvil next to the counter.
	block(model, new Vector3(2, 1.6, 1.4), at(-9, 0.9, -2), Color3.fromRGB(70, 72, 78), Enum.Material.Metal);
	block(model, new Vector3(3.6, 0.9, 1.6), at(-9, 2.15, -2), Color3.fromRGB(96, 100, 108), Enum.Material.Metal);
	block(model, new Vector3(1.2, 0.3, 1.2), at(9, 3.75, -3.4), accent, Enum.Material.Neon);
}

/** A rounded sack with a strap: our "bag" without any mesh. */
function sack(model: Model, cframe: CFrame, color: Color3, scale: number): void {
	const body = block(model, new Vector3(2.4, 2.6, 1.8).mul(scale), cframe, color, Enum.Material.Fabric);
	body.Shape = Enum.PartType.Block;
	block(
		model,
		new Vector3(2.5, 0.5, 1.9).mul(scale),
		cframe.mul(new CFrame(0, 1.2 * scale, 0)),
		Color3.fromRGB(60, 42, 28),
		Enum.Material.Fabric,
	);
	block(
		model,
		new Vector3(0.7, 0.6, 0.2).mul(scale),
		cframe.mul(new CFrame(0, 0.1, -1 * scale)),
		Color3.fromRGB(230, 190, 80),
		Enum.Material.Metal,
	);
}

function bagDecor(model: Model, at: At): void {
	shelf(model, at, 3.4);
	shelf(model, at, 7);
	const colors = [
		Color3.fromRGB(150, 106, 64),
		Color3.fromRGB(88, 130, 70),
		Color3.fromRGB(176, 74, 60),
		Color3.fromRGB(70, 110, 160),
	];
	for (let i = 0; i < 4; i++) {
		sack(model, at(-7.5 + i * 5, 5, 6.2), colors[i], 0.95);
		sack(model, at(-7.5 + i * 5, 8.4, 6.2), colors[3 - i], 0.8);
	}
	sack(model, at(8.6, 1.7, -2), colors[0], 1.25);
}

/** A boot made of two blocks. */
function boot(model: Model, cframe: CFrame, color: Color3): void {
	block(model, new Vector3(1.1, 1.5, 1.2), cframe.mul(new CFrame(0, 0.55, 0.35)), color, Enum.Material.SmoothPlastic);
	block(
		model,
		new Vector3(1.15, 0.8, 2.2),
		cframe.mul(new CFrame(0, -0.4, -0.15)),
		color,
		Enum.Material.SmoothPlastic,
	);
	block(
		model,
		new Vector3(1.25, 0.25, 2.35),
		cframe.mul(new CFrame(0, -0.9, -0.15)),
		Color3.fromRGB(245, 245, 245),
		Enum.Material.SmoothPlastic,
	);
}

function shoeDecor(model: Model, at: At): void {
	shelf(model, at, 3.4);
	shelf(model, at, 7);
	const colors = [
		Color3.fromRGB(235, 90, 80),
		Color3.fromRGB(80, 160, 245),
		Color3.fromRGB(245, 200, 70),
		Color3.fromRGB(150, 110, 230),
	];
	for (let i = 0; i < 4; i++) {
		for (let pair = 0; pair < 2; pair++) {
			boot(model, at(-8.4 + i * 5.2 + pair * 1.6, 4.7, 6.2), colors[i]);
			boot(model, at(-8.4 + i * 5.2 + pair * 1.6, 8.3, 6.2), colors[(i + 2) % 4]);
		}
	}
}

export function buildShopDecor(
	model: Model,
	slot: GearSlot,
	at: At,
	accent: Color3,
	pickaxes: ReadonlyArray<Instance>,
): void {
	if (slot === "pickaxe") {
		pickaxeDecor(model, at, accent, pickaxes);
	} else if (slot === "bag") {
		bagDecor(model, at);
	} else {
		shoeDecor(model, at);
	}
}
