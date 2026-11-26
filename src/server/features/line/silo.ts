// The map author's silo on the belt (decision 047) is the line's intake: the player hands in ore at its SiloIntake,
// the ore waits inside (the line's intake queue, which already existed) and rides out of SiloOutlet to machine 1.
// The silo only shows it: the gauge glows brighter the fuller it is, dust puffs while ore leaves, a label counts.
import { SILO } from "shared/config/map-contract";
import { LineState, hopperCapacity } from "shared/features/line";

/** Gauge transparency when empty and when full. */
const GAUGE_EMPTY = 0.85;
const GAUGE_FULL = 0;

const COUNTER_NAME = "SiloCounter";

/** Height of the drop prompt above the silo's floor (studs): about a character's chest. */
const PROMPT_HEIGHT = 3;

export interface Silo {
	readonly model: Instance;
	/** Where the "drop ore" prompt goes. */
	readonly intake: Vector3;
}

function makeCounter(model: Instance): void {
	const frame = model.FindFirstChild(SILO.Intake, true)?.Parent;
	if (frame === undefined || !frame.IsA("BasePart") || frame.FindFirstChild(COUNTER_NAME) !== undefined) {
		return;
	}
	const gui = new Instance("BillboardGui");
	gui.Name = COUNTER_NAME;
	gui.Size = UDim2.fromOffset(120, 36);
	gui.StudsOffsetWorldSpace = new Vector3(0, frame.Size.Y / 2 + 2, 0);
	gui.MaxDistance = 80;
	gui.AlwaysOnTop = false;
	const label = new Instance("TextLabel");
	label.Name = "Count";
	label.BackgroundTransparency = 1;
	label.Size = UDim2.fromScale(1, 1);
	label.Font = Enum.Font.FredokaOne;
	label.TextScaled = true;
	label.TextColor3 = Color3.fromRGB(253, 224, 71);
	label.TextStrokeTransparency = 0.2;
	label.Parent = gui;
	gui.Parent = frame;
}

/** The silo in a built Factory folder, or undefined when the plot has none (then the plain booth is used). */
export function findSilo(built: Instance): Silo | undefined {
	const model = built.FindFirstChild(SILO.Model);
	const intake = model?.FindFirstChild(SILO.Intake, true);
	if (model === undefined || intake === undefined || !intake.IsA("Attachment")) {
		return undefined;
	}
	makeCounter(model);
	// SiloIntake may sit high on the elevator; the prompt goes under it at chest height, where a player stands.
	const at = intake.WorldPosition;
	const floor = model.IsA("Model") ? model.GetBoundingBox()[0].Position.Y - model.GetBoundingBox()[1].Y / 2 : at.Y;
	return { model, intake: new Vector3(at.X, math.min(at.Y, floor + PROMPT_HEIGHT), at.Z) };
}

/** Shows how full the silo is. Cheap; called every line tick (properties are set only when they change). */
export function refreshSilo(silo: Silo, line: LineState): void {
	const capacity = hopperCapacity(line);
	const fill = math.clamp(line.intake.size() / capacity, 0, 1);
	const gauge = silo.model.FindFirstChild(SILO.Gauge, true);
	if (gauge !== undefined && gauge.IsA("BasePart")) {
		const transparency = GAUGE_EMPTY + (GAUGE_FULL - GAUGE_EMPTY) * fill;
		if (math.abs(gauge.Transparency - transparency) > 0.01) {
			gauge.Transparency = transparency;
		}
	}
	const busy = line.intake.size() > 0;
	for (const emitter of silo.model.FindFirstChild(SILO.Dust, true)?.GetChildren() ?? []) {
		if (emitter.IsA("ParticleEmitter") && emitter.Enabled !== busy) {
			emitter.Enabled = busy;
		}
	}
	const label = silo.model.FindFirstChild(COUNTER_NAME, true)?.FindFirstChild("Count");
	const text = `${line.intake.size()} / ${capacity}`;
	if (label !== undefined && label.IsA("TextLabel") && label.Text !== text) {
		label.Text = text;
	}
}
