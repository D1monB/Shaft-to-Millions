// Mounts the React UI. Features register their HUD stats, buttons and goal sources in their start
// functions, so this runs AFTER every controller has started.
import { useViewport } from "@rbxts/pretty-react-hooks";
import React from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { GoalBanner } from "client/features/goals";
import { Hud } from "client/features/hud";
import { useLanguageChoice } from "client/lib/i18n";
import { PanelHost, ToastHost } from "client/lib/ui-kit";

/**
 * The UI is designed at this screen height; smaller screens (phones) scale it down, big ones up.
 * 760 since the dark-glass restyle (decision 029): at 620 the UI was 1.4x on a PC screen and felt bulky. The floor of
 * 0.7 keeps text readable on phones (it used to shrink to 0.6 and gave ~10 px text).
 */
const DESIGN_HEIGHT = 760;
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.5;

function scaleFor(viewport: Vector2): number {
	return math.clamp(viewport.Y / DESIGN_HEIGHT, MIN_SCALE, MAX_SCALE);
}

function App() {
	const viewport = useViewport();
	const scale = viewport.map(scaleFor);
	// A language change re-mounts the UI (the key), so every t() call during render picks up the new words.
	const choice = useLanguageChoice();
	return (
		<screengui
			key={choice.language}
			// Our own languages are already translated; only English shown to players of other languages may be
			// auto-translated by Roblox (decision 033).
			AutoLocalize={choice.robloxTranslates}
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
		</screengui>
	);
}

export function mountUi(): void {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
	// The root container itself is never parented; the portal puts the ScreenGui into PlayerGui.
	const root = createRoot(new Instance("Folder"));
	root.render(createPortal(<App />, playerGui));
}
