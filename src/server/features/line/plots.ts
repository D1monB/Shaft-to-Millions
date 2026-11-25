// The tycoon plots on the map (docs/map-contract.md, PLOTS). Every plot starts empty. The map author's Factory
// (belt, SellStation, machine models) is taken off the map at server start and kept in ServerStorage as a template;
// when a player claims a plot, the belt and the SellStation are built there, and each machine appears only after it
// is bought. A plot without its own Factory uses the first plot's one, placed the same way relative to its Base.
// The place file is never changed: everything here exists only while the server runs.
import { ServerStorage, Workspace } from "@rbxts/services";
import { PLOTS, PLOT_ATTRIBUTES } from "shared/config/map-contract";

interface Layout {
	/** The template Factory (in ServerStorage), never parented to the map. */
	readonly factory: Instance;
	/** Moves template positions onto this plot. Identity for the plot the template came from. */
	readonly transform: CFrame;
	/** Template machine models by stage (1..12). */
	readonly machines: ReadonlyMap<number, Model>;
}

export interface Plot {
	readonly model: Model;
	readonly base: BasePart;
	readonly layout: Layout;
	/** The built Factory folder while the plot has an owner. */
	built?: Folder;
	/** Machine models standing on the plot, by stage. */
	readonly placed: Map<number, Model>;
}

const TEMPLATE_FOLDER = "LineTemplates";

function plotModels(): Model[] {
	const folder = Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(PLOTS.PlotsFolder);
	if (folder === undefined) {
		return [];
	}
	const plots = folder.GetChildren().filter((child): child is Model => child.IsA("Model"));
	const indexOf = (plot: Model) => {
		const value = plot.GetAttribute(PLOT_ATTRIBUTES.PlotIndex);
		return typeIs(value, "number") ? value : math.huge;
	};
	plots.sort((a, b) => indexOf(a) < indexOf(b));
	return plots;
}

function baseOf(plot: Model): BasePart | undefined {
	const base = plot.FindFirstChild(PLOTS.Base);
	return base !== undefined && base.IsA("BasePart") ? base : undefined;
}

/** Moves every model and part under `root` by `transform` (parts keep their attachments and children). */
function moveAll(root: Instance, transform: CFrame): void {
	for (const child of root.GetChildren()) {
		if (child.IsA("Model")) {
			child.PivotTo(transform.mul(child.GetPivot()));
		} else if (child.IsA("BasePart")) {
			child.CFrame = transform.mul(child.CFrame);
		} else {
			moveAll(child, transform);
		}
	}
}

function machinesOf(factory: Instance): Map<number, Model> {
	const machines = new Map<number, Model>();
	for (const machine of factory.FindFirstChild(PLOTS.Machines)?.GetChildren() ?? []) {
		const stage = machine.GetAttribute(PLOT_ATTRIBUTES.Stage);
		if (machine.IsA("Model") && typeIs(stage, "number")) {
			machines.set(stage, machine);
		}
	}
	return machines;
}

/** All plots in PlotIndex order, emptied: every Factory is moved off the map into a template folder. */
export function loadPlots(): Plot[] {
	const models = plotModels();
	const storage = new Instance("Folder");
	storage.Name = TEMPLATE_FOLDER;
	storage.Parent = ServerStorage;
	const shared = models.find((plot) => plot.FindFirstChild(PLOTS.Factory) !== undefined);
	const sharedBase = shared !== undefined ? baseOf(shared) : undefined;
	const sharedFactory = shared?.FindFirstChild(PLOTS.Factory);
	// Take every Factory off the map first, so the shared template is safe before any plot is read.
	const own = new Map<Model, Instance>();
	for (const plot of models) {
		const factory = plot.FindFirstChild(PLOTS.Factory);
		if (factory !== undefined) {
			own.set(plot, factory);
			factory.Parent = storage;
		}
	}
	const plots: Plot[] = [];
	for (const model of models) {
		const base = baseOf(model);
		if (base === undefined) {
			warn(`[line] ${model.Name} has no Base and is skipped`);
			continue;
		}
		const factory = own.get(model) ?? sharedFactory;
		if (factory === undefined || sharedBase === undefined) {
			warn(`[line] no Factory template on the map: ${model.Name} stays empty`);
			continue;
		}
		const transform = own.has(model) ? new CFrame() : base.CFrame.mul(sharedBase.CFrame.Inverse());
		plots.push({ model, base, layout: { factory, transform, machines: machinesOf(factory) }, placed: new Map() });
	}
	return plots;
}

/** Where machine `stage` stands on this plot (its pivot), even before it is bought. */
export function slotCFrame(plot: Plot, stage: number): CFrame | undefined {
	const template = plot.layout.machines.get(stage);
	return template !== undefined ? plot.layout.transform.mul(template.GetPivot()) : undefined;
}

/** The point players appear at on this plot: Base.PlayerSpawn, or the middle of the Base. */
export function spawnPosition(plot: Plot): Vector3 {
	const spawn = plot.base.FindFirstChild("PlayerSpawn");
	const position = spawn !== undefined && spawn.IsA("Attachment") ? spawn.WorldPosition : plot.base.Position;
	return position.add(new Vector3(0, 4, 0));
}

/** Builds the belt and the SellStation (everything of the Factory except the machines). Machines come one by one. */
export function buildBase(plot: Plot): Folder {
	clearBase(plot);
	const built = new Instance("Folder");
	built.Name = PLOTS.Factory;
	for (const child of plot.layout.factory.GetChildren()) {
		if (child.Name === PLOTS.Machines) {
			continue;
		}
		const copy = child.Clone();
		const holder = new Instance("Folder");
		copy.Parent = holder;
		moveAll(holder, plot.layout.transform);
		copy.Parent = built;
		holder.Destroy();
	}
	const machines = new Instance("Folder");
	machines.Name = PLOTS.Machines;
	machines.Parent = built;
	built.Parent = plot.model;
	plot.built = built;
	return built;
}

/** Puts the model of machine `stage` on the plot (after it is bought or when the owner's line is rebuilt). */
export function placeMachine(plot: Plot, stage: number): Model | undefined {
	const template = plot.layout.machines.get(stage);
	const folder = plot.built?.FindFirstChild(PLOTS.Machines);
	if (template === undefined || folder === undefined || plot.placed.has(stage)) {
		return plot.placed.get(stage);
	}
	const machine = template.Clone();
	machine.PivotTo(plot.layout.transform.mul(template.GetPivot()));
	machine.SetAttribute(PLOT_ATTRIBUTES.Bought, true);
	machine.Parent = folder;
	plot.placed.set(stage, machine);
	return machine;
}

/** Removes everything built on the plot: it is empty again. */
export function clearBase(plot: Plot): void {
	plot.built?.Destroy();
	plot.built = undefined;
	plot.placed.clear();
}
