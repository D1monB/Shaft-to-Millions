// The newcomer guide (decision 070): a small card at the top saying what to do next, and a glowing arrow in the world
// leading there. The ✕ closes it for good (saved on the server). Looks only; nothing here moves value.
import React, { useEffect, useState } from "@rbxts/react";
import { CollectionService, Players, RunService, Workspace } from "@rbxts/services";
import { ATTRIBUTES, PLOT_ATTRIBUTES, PLOTS, TAGS } from "shared/config/map-contract";
import { ORES, isOreId } from "shared/config/ores";
import { StringKey } from "shared/config/i18n";
import { PlayerView } from "shared/features/profile";
import {
	CLOSE_GUIDE_REMOTE,
	TUTORIAL_ORE,
	TutorialStep,
	tutorialStatsOf,
	tutorialStep,
} from "shared/features/progress";
import { getView } from "client/features/profile";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";
import { COLORS, FONTS, RADIUS, STROKE, TEXT_SIZES } from "client/lib/ui-kit";

const UPDATE_SECONDS = 0.5;

function ownPlot(): Model | undefined {
	const plots = Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(PLOTS.PlotsFolder);
	return plots
		?.GetChildren()
		.find(
			(plot): plot is Model =>
				plot.IsA("Model") && plot.GetAttribute(PLOT_ATTRIBUTES.Owner) === Players.LocalPlayer.UserId,
		);
}

export function currentStep(view: PlayerView): TutorialStep | undefined {
	return view.guideClosed ? undefined : tutorialStep(tutorialStatsOf(view, ownPlot() !== undefined));
}

function positionOf(instance: Instance): Vector3 | undefined {
	if (instance.IsA("BasePart")) {
		return instance.Position;
	}
	return instance.IsA("Model") ? instance.GetPivot().Position : undefined;
}

function nearest(from: Vector3, instances: ReadonlyArray<Instance>): Vector3 | undefined {
	let best: Vector3 | undefined;
	let distance = math.huge;
	for (const instance of instances) {
		const position = instance.IsDescendantOf(Workspace) ? positionOf(instance) : undefined;
		if (position !== undefined && position.sub(from).Magnitude < distance) {
			best = position;
			distance = position.sub(from).Magnitude;
		}
	}
	return best;
}

/** Where the arrow points for a step; undefined when that place is not on this client yet (streaming). */
function targetOf(step: TutorialStep, from: Vector3): Vector3 | undefined {
	if (step === "mine") {
		const firstLayer = CollectionService.GetTagged(TAGS.OreNode).filter((node) => {
			const oreId = node.GetAttribute(ATTRIBUTES.OreId);
			return isOreId(oreId) && ORES[oreId].layer === 1;
		});
		return nearest(from, firstLayer);
	}
	if (step === "sell") {
		return nearest(from, CollectionService.GetTagged(TAGS.SellZone));
	}
	if (step === "gear") {
		return nearest(from, CollectionService.GetTagged(TAGS.Shop));
	}
	if (step === "plot") {
		const plots = Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(PLOTS.PlotsFolder);
		const free = (plots?.GetChildren() ?? []).filter((plot) => plot.GetAttribute(PLOT_ATTRIBUTES.Owner) === 0);
		return nearest(
			from,
			free.map((plot) => plot.FindFirstChild("ClaimPoint") ?? plot),
		);
	}
	const plot = ownPlot();
	return plot !== undefined ? positionOf(plot.FindFirstChild(PLOTS.Base) ?? plot) : undefined;
}

interface Arrow {
	readonly marker: Part;
	readonly beam: Beam;
	readonly start: Attachment;
}

function makeArrow(root: BasePart): Arrow {
	const marker = new Instance("Part");
	marker.Name = "GuideArrow";
	marker.Anchored = true;
	marker.CanCollide = false;
	marker.CanQuery = false;
	marker.CanTouch = false;
	marker.Transparency = 1;
	marker.Size = new Vector3(1, 1, 1);
	const finish = new Instance("Attachment");
	finish.Parent = marker;
	const gui = new Instance("BillboardGui");
	gui.Size = UDim2.fromOffset(60, 60);
	gui.StudsOffsetWorldSpace = new Vector3(0, 5, 0);
	gui.AlwaysOnTop = true;
	const label = new Instance("TextLabel");
	label.BackgroundTransparency = 1;
	label.Size = UDim2.fromScale(1, 1);
	label.Text = "⬇";
	label.TextScaled = true;
	label.TextColor3 = COLORS.gold;
	label.TextStrokeTransparency = 0;
	label.Parent = gui;
	gui.Parent = marker;
	const start = new Instance("Attachment");
	start.Parent = root;
	const beam = new Instance("Beam");
	beam.Attachment0 = start;
	beam.Attachment1 = finish;
	beam.Color = new ColorSequence(COLORS.gold);
	beam.Width0 = 0.6;
	beam.Width1 = 0.6;
	beam.FaceCamera = true;
	beam.LightEmission = 1;
	beam.Transparency = new NumberSequence(0.35);
	beam.Parent = marker;
	return { marker, beam, start };
}

let arrow: Arrow | undefined;

function removeArrow(): void {
	arrow?.marker.Destroy();
	arrow?.start.Destroy();
	arrow = undefined;
}

function updateArrow(): void {
	const view = getView();
	const step = view !== undefined ? currentStep(view) : undefined;
	const root = Players.LocalPlayer.Character?.FindFirstChild("HumanoidRootPart");
	if (step === undefined || root === undefined || !root.IsA("BasePart")) {
		removeArrow();
		return;
	}
	const target = targetOf(step, root.Position);
	if (target === undefined) {
		removeArrow();
		return;
	}
	if (arrow === undefined || arrow.start.Parent !== root) {
		removeArrow();
		arrow = makeArrow(root);
		arrow.marker.Parent = Workspace;
	}
	arrow.marker.Position = target.add(new Vector3(0, 2, 0));
}

export function startGuideArrow(): void {
	let elapsed = 0;
	RunService.Heartbeat.Connect((dt) => {
		elapsed += dt;
		if (elapsed >= UPDATE_SECONDS) {
			elapsed = 0;
			updateArrow();
		}
	});
}

/** The card at the top: the step in words and a ✕ that closes the guide. */
export function GuideCard() {
	const [step, setStep] = useState<TutorialStep | undefined>(undefined);
	useEffect(() => {
		let running = true;
		task.spawn(() => {
			while (running) {
				const view = getView();
				setStep(view !== undefined ? currentStep(view) : undefined);
				task.wait(UPDATE_SECONDS);
			}
		});
		return () => {
			running = false;
		};
	}, []);
	if (step === undefined) {
		return undefined;
	}
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, -60, 0, 12)}
			Size={new UDim2(0, 320, 0, 44)}
			BackgroundColor3={COLORS.woodDark}
		>
			<uicorner CornerRadius={RADIUS.medium} />
			<uistroke Color={COLORS.gold} Thickness={STROKE.thick} />
			<textlabel
				BackgroundTransparency={1}
				Position={new UDim2(0, 12, 0, 0)}
				Size={new UDim2(1, -56, 1, 0)}
				Font={FONTS.display}
				Text={`👉 ${t(`guide.${step}` as StringKey, { count: TUTORIAL_ORE })}`}
				TextSize={TEXT_SIZES.small + 1}
				TextColor3={COLORS.white}
				TextWrapped={true}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>
			<textbutton
				AnchorPoint={new Vector2(1, 0.5)}
				Position={new UDim2(1, -6, 0.5, 0)}
				Size={new UDim2(0, 32, 0, 32)}
				BackgroundColor3={COLORS.canyonDark}
				Font={FONTS.display}
				Text="✕"
				TextSize={TEXT_SIZES.body}
				TextColor3={COLORS.white}
				Event={{
					Activated: () => {
						setStep(undefined);
						removeArrow();
						sendToServer(CLOSE_GUIDE_REMOTE);
					},
				}}
			>
				<uicorner CornerRadius={RADIUS.small} />
			</textbutton>
		</frame>
	);
}
