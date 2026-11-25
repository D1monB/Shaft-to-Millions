// Finding the tycoon plots on the map (docs/map-contract.md, PLOTS). The map author built the factory only on the
// first plot; every plot without a Factory gets a copy of it at runtime, placed the same way relative to its Base.
// The place file is never changed: the copies exist only while the server runs.
import { Workspace } from "@rbxts/services";
import { PLOTS, PLOT_ATTRIBUTES } from "shared/config/map-contract";

export interface Plot {
	readonly model: Model;
	/** Machine models by stage (1..12). */
	readonly machines: Map<number, Model>;
	readonly conveyors: BasePart[];
}

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

/** Gives every plot without a Factory a copy of the first plot's Factory. Returns how many copies were made. */
function copyMissingFactories(plots: Model[]): number {
	const template = plots.find((plot) => plot.FindFirstChild(PLOTS.Factory) !== undefined);
	const templateBase = template !== undefined ? baseOf(template) : undefined;
	const templateFactory = template?.FindFirstChild(PLOTS.Factory);
	if (template === undefined || templateBase === undefined || templateFactory === undefined) {
		return 0;
	}
	let copies = 0;
	for (const plot of plots) {
		const base = baseOf(plot);
		if (plot === template || base === undefined || plot.FindFirstChild(PLOTS.Factory) !== undefined) {
			continue;
		}
		const copy = templateFactory.Clone();
		moveAll(copy, base.CFrame.mul(templateBase.CFrame.Inverse()));
		copy.Parent = plot;
		copies += 1;
	}
	return copies;
}

function readPlot(model: Model): Plot {
	const machines = new Map<number, Model>();
	const conveyors: BasePart[] = [];
	const factory = model.FindFirstChild(PLOTS.Factory);
	for (const machine of factory?.FindFirstChild(PLOTS.Machines)?.GetChildren() ?? []) {
		const stage = machine.GetAttribute(PLOT_ATTRIBUTES.Stage);
		if (machine.IsA("Model") && typeIs(stage, "number")) {
			machines.set(stage, machine);
		}
	}
	for (const part of factory?.FindFirstChild(PLOTS.Conveyors)?.GetDescendants() ?? []) {
		if (part.IsA("BasePart")) {
			conveyors.push(part);
		}
	}
	return { model, machines, conveyors };
}

/** All plots in PlotIndex order, after copying the factory to plots that lack one. */
export function loadPlots(): Plot[] {
	const models = plotModels();
	const copies = copyMissingFactories(models);
	if (copies > 0) {
		print(`[line] copied the factory to ${copies} plot(s)`);
	}
	return models.map(readPlot);
}
