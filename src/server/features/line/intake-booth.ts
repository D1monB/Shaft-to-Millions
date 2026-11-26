// The booth at the start of the belt (decision 039): the player hands in ore here and it rides the belt out of the
// booth to the first machine. The model is the map author's ServerStorage.LineTemplates/IntakeBooth, its pivot where
// the belt starts and facing the way items ride. Until it exists, a plain wooden booth stands in for it.
import { ServerStorage } from "@rbxts/services";
import { INTAKE_BOOTH } from "shared/config/map-contract";

const PLACEHOLDER_SIZE = new Vector3(7, 7, 6);

function placeholder(): Model {
	const model = new Instance("Model");
	const box = new Instance("Part");
	box.Name = "Body";
	box.Anchored = true;
	box.Size = PLACEHOLDER_SIZE;
	box.Material = Enum.Material.WoodPlanks;
	box.Color = Color3.fromRGB(124, 84, 52);
	// Behind the pivot (the belt start), so the belt comes out of its front face.
	box.CFrame = new CFrame(0, PLACEHOLDER_SIZE.Y / 2 - 1, PLACEHOLDER_SIZE.Z / 2);
	box.Parent = model;
	model.PrimaryPart = box;
	model.WorldPivot = new CFrame();
	return model;
}

/** Puts the booth at the belt start; returns it so the drop prompt can sit on it. */
export function placeIntakeBooth(parent: Instance, at: CFrame): Model {
	const template = ServerStorage.FindFirstChild(INTAKE_BOOTH.TemplateFolder)?.FindFirstChild(INTAKE_BOOTH.Model);
	const booth = template !== undefined && template.IsA("Model") ? template.Clone() : placeholder();
	booth.Name = INTAKE_BOOTH.Model;
	for (const descendant of booth.GetDescendants()) {
		if (descendant.IsA("BasePart")) {
			descendant.Anchored = true;
		}
	}
	booth.PivotTo(at);
	booth.Parent = parent;
	return booth;
}
