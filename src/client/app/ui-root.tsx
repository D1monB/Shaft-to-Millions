// Mounts the React UI. Features register their HUD stats, buttons and goal sources in their start
// functions, so this runs AFTER every controller has started.
import { useViewport } from "@rbxts/pretty-react-hooks";
import React from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { MachineBoards } from "client/features/factory";
import { GoalBanner } from "client/features/goals";
import { Hud } from "client/features/hud";
import { PanelHost, ToastHost } from "client/lib/ui-kit";

/**
 * The UI is designed at this screen height; smaller screens (phones) scale it down, big ones up.
 * Why 620 and not larger: the first play-test found the UI too small. A lower design height makes everything bigger on
 * every screen, and the floor of 0.7 keeps text readable on phones (it used to shrink to 0.6 and gave ~10 px text).
 */
const DESIGN_HEIGHT = 620;
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.5;

function scaleFor(viewport: Vector2): number {
	return math.clamp(viewport.Y / DESIGN_HEIGHT, MIN_SCALE, MAX_SCALE);
}

function App() {
	const viewport = useViewport();
	const scale = viewport.map(scaleFor);
	return (
		<screengui
			ResetOnSpawn={false}
			IgnoreGuiInset={false}
			ZIndexBehavior={Enum.ZIndexBehavior.Sibling}
			ScreenInsets={Enum.ScreenInsets.CoreUISafeInsets}
		>
			{/* UIScale also shrinks sizes, so the root frame is enlarged by 1/scale to still fill the screen. */}
			<frame BackgroundTransparency={1} Size={scale.map((value) => new UDim2(1 / value, 0, 1 / value, 0))}>
				<uiscale Scale={scale} />
				<Hud />
				<GoalBanner />
				<ToastHost />
				<PanelHost />
			</frame>
			<MachineBoards />
		</screengui>
	);
}

export function mountUi(): void {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
	// The root container itself is never parented; the portal puts the ScreenGui into PlayerGui.
	const root = createRoot(new Instance("Folder"));
	root.render(createPortal(<App />, playerGui));
}
