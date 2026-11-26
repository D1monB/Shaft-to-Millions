// Icons made from the map author's 3D models in a ViewportFrame: pickaxes, pets and ores look like the real thing,
// with no image assets to upload. Where there is no model the caller keeps its emoji.
import React, { useEffect, useRef } from "@rbxts/react";
import { ReplicatedStorage } from "@rbxts/services";
import { PLOT_ATTRIBUTES } from "shared/config/map-contract";

const PICKAXES_FOLDER = "PickaxeTemplates";
const PETS_FOLDER = "PetModels";
/** Copied from ServerStorage by the server at start (line feature). */
const ITEMS_FOLDER = "ItemTemplates";

export function pickaxeTemplate(tool: string): Instance | undefined {
	return ReplicatedStorage.FindFirstChild(PICKAXES_FOLDER)?.FindFirstChild(tool);
}

export function petTemplate(itemId: string): Instance | undefined {
	return ReplicatedStorage.FindFirstChild(PETS_FOLDER)?.FindFirstChild(itemId);
}

/** The raw-ore model (Stage 0) of this ore. */
export function oreTemplate(oreId: string): Instance | undefined {
	return ReplicatedStorage.FindFirstChild(ITEMS_FOLDER)
		?.FindFirstChild(oreId)
		?.GetChildren()
		.find((child) => child.GetAttribute(PLOT_ATTRIBUTES.Stage) === 0);
}

export interface ModelIconProps {
	readonly template: Instance;
	readonly size: UDim2;
	readonly position?: UDim2;
	readonly anchor?: Vector2;
	readonly zIndex?: number;
}

/** The model seen from the front-right and a little above, filling the frame. */
export function ModelIcon(props: ModelIconProps) {
	const frame = useRef<ViewportFrame>();
	useEffect(() => {
		const viewport = frame.current;
		if (viewport === undefined) {
			return;
		}
		// Only the looks: parts and what makes them look right (meshes, textures). No scripts, sounds or effects.
		const model = new Instance("Model");
		const parts = props.template.IsA("BasePart") ? [props.template] : props.template.GetDescendants();
		for (const part of parts) {
			if (part.IsA("BasePart")) {
				const copy = part.Clone();
				for (const child of copy.GetChildren()) {
					if (!child.IsA("SurfaceAppearance") && !child.IsA("DataModelMesh") && !child.IsA("Decal")) {
						child.Destroy();
					}
				}
				copy.Parent = model;
			}
		}
		const [box, size] = model.GetBoundingBox();
		const camera = new Instance("Camera");
		camera.FieldOfView = 30;
		const distance = math.max(size.X, size.Y, size.Z, 0.1) * 2.1;
		const eye = box.Position.add(new Vector3(distance * 0.55, distance * 0.25, distance));
		camera.CFrame = CFrame.lookAt(eye, box.Position);
		camera.Parent = viewport;
		viewport.CurrentCamera = camera;
		model.Parent = viewport;
		return () => {
			model.Destroy();
			camera.Destroy();
		};
	}, [props.template]);
	return (
		<viewportframe
			ref={frame}
			AnchorPoint={props.anchor}
			BackgroundTransparency={1}
			Size={props.size}
			Position={props.position}
			Ambient={Color3.fromRGB(200, 200, 210)}
			LightColor={Color3.fromRGB(255, 255, 255)}
			LightDirection={new Vector3(-1, -1, -1)}
			ZIndex={props.zIndex}
		/>
	);
}
