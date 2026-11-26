// Every bought machine on a plot hums with its own loop (decision 051), heard only near it. Client only: the hum is
// added to machines close to the camera and removed when the camera goes away, so six plots of twelve machines never
// play 72 sounds at once.
import { Workspace } from "@rbxts/services";
import { LINE_MACHINES } from "shared/config/line";
import { PLOTS, PLOT_ATTRIBUTES } from "shared/config/map-contract";
import { MACHINE_SOUNDS } from "shared/config/sounds";

const HUM_NAME = "MachineHum";
/** Machines closer than this to the camera hum (studs). */
const HUM_DISTANCE = 90;
/** The hum fades out over this distance from the machine (studs). */
const HUM_ROLLOFF = 60;
const CHECK_SECONDS = 1;

function machineModels(): Array<Model> {
	const models = new Array<Model>();
	const plots = Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(PLOTS.PlotsFolder);
	for (const plot of plots?.GetChildren() ?? []) {
		const machines = plot.FindFirstChild(PLOTS.Factory)?.FindFirstChild(PLOTS.Machines);
		for (const machine of machines?.GetChildren() ?? []) {
			if (machine.IsA("Model")) {
				models.push(machine);
			}
		}
	}
	return models;
}

function anchorOf(machine: Model): BasePart | undefined {
	return machine.PrimaryPart ?? machine.FindFirstChildWhichIsA("BasePart", true);
}

function addHum(machine: Model, part: BasePart): void {
	const stage = machine.GetAttribute(PLOT_ATTRIBUTES.Stage);
	const def = typeIs(stage, "number") ? MACHINE_SOUNDS[LINE_MACHINES[stage - 1]?.id ?? ""] : undefined;
	if (def === undefined || def.loop.assetId === "") {
		return;
	}
	const sound = new Instance("Sound");
	sound.Name = HUM_NAME;
	sound.SoundId = def.loop.assetId;
	sound.Volume = def.loop.volume;
	sound.PlaybackSpeed = def.loop.speed ?? 1;
	sound.Looped = true;
	sound.RollOffMaxDistance = HUM_ROLLOFF;
	sound.RollOffMinDistance = 8;
	// A random start, so neighbouring machines with the same loop do not play in step.
	sound.TimePosition = math.random() * 20;
	sound.Parent = part;
	sound.Play();
}

function refresh(): void {
	const camera = Workspace.CurrentCamera?.CFrame.Position;
	if (camera === undefined) {
		return;
	}
	for (const machine of machineModels()) {
		const part = anchorOf(machine);
		if (part === undefined) {
			continue;
		}
		const hum = part.FindFirstChild(HUM_NAME);
		const near = part.Position.sub(camera).Magnitude <= HUM_DISTANCE;
		if (near && hum === undefined) {
			addHum(machine, part);
		} else if (!near && hum !== undefined) {
			hum.Destroy();
		}
	}
}

export function startMachineHum(): void {
	task.spawn(() => {
		for (;;) {
			// pcall: a machine model being rebuilt mid-check must not stop the hum loop.
			pcall(refresh);
			task.wait(CHECK_SECONDS);
		}
	});
}
