// The tycoon line on the server (decisions 027): plot ownership, buying machines and dropping ore through the
// ProximityPrompts on the machine models, upgrades through a remote, the production tick and the offline run.
// Everything that moves value happens here; the client only sees the result in its view and the machine attributes.
import { Players } from "@rbxts/services";
import { LINE_MACHINES } from "shared/config/line";
import { PLOT_ATTRIBUTES } from "shared/config/map-contract";
import { ORES, ORE_IDS, isOreId } from "shared/config/ores";
import {
	LINE_DISTANCE,
	LineState,
	UPGRADE_LINE_MACHINE_REMOTE,
	advanceLine,
	advanceOffline,
	applyBuyLineMachine,
	applyLineUpgrade,
	depositOre,
	isLineIdle,
	lineIncome,
	machineAction,
	tryBuyLineMachine,
	tryLineUpgrade,
} from "shared/features/line";
import { ProfileData } from "shared/features/profile";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { MAX_COUNTER } from "shared/lib/repair";
import { isIntegerInRange } from "shared/lib/validate";
import {
	getLoadedPlayers,
	getProfileData,
	markDirty,
	onProfileLoaded,
	onProfileReleasing,
} from "server/features/profile";
import { getSellMultiplier } from "server/features/selling";
import { notify } from "server/lib/notify";
import { getInstancePosition, getRootPosition } from "server/lib/proximity";
import { logAbuse, onClientRequest } from "server/lib/remotes";
import { Plot, loadPlots } from "./plots";

const TICK_SECONDS = 1;

/** Name of the prompt this service creates, so a prompt the map author adds never blocks ours. */
const PROMPT_NAME = "LineMachinePrompt";

let plots: Plot[] = [];
const plotOf = new Map<Player, Plot>();
const random = new Random();
const promptLimiter = new RateLimiter(8, 4);

const valueOf = (ore: string) => (isOreId(ore) ? ORES[ore].price : undefined);
const roll = () => random.NextNumber();

function nowUnix(): number {
	return os.time();
}

/** Adds line income (after the pet bonus) to money and lifetime earnings. Returns what was added. */
function credit(player: Player, data: ProfileData, money: number): number {
	const income = lineIncome(money, getSellMultiplier(player));
	if (income > 0) {
		data.money = math.min(data.money + income, MAX_COUNTER);
		data.stats.totalEarned = math.min(data.stats.totalEarned + income, MAX_COUNTER);
	}
	return income;
}

function isNearMachine(player: Player, plot: Plot, stage: number): boolean {
	const machine = plot.machines.get(stage);
	const root = getRootPosition(player);
	const target = machine !== undefined ? getInstancePosition(machine) : undefined;
	return root !== undefined && target !== undefined && target.sub(root).Magnitude <= LINE_DISTANCE;
}

// ---- visuals: prompts, bought machines, belts ----

/** The prompt this service put on a machine (it lives on the machine's main part, see addPrompts). */
function promptOf(machine: Model): ProximityPrompt | undefined {
	const prompt = machine.FindFirstChild(PROMPT_NAME, true);
	return prompt !== undefined && prompt.IsA("ProximityPrompt") ? prompt : undefined;
}

/** Updates prompts, the Bought attribute of every machine and the belts of a plot for its owner's line. */
function refreshPlot(plot: Plot, line: LineState | undefined): void {
	for (const [stage, machine] of plot.machines) {
		const def = LINE_MACHINES[stage - 1];
		const bought = line !== undefined && stage <= line.machines.size();
		if (machine.GetAttribute(PLOT_ATTRIBUTES.Bought) !== bought) {
			machine.SetAttribute(PLOT_ATTRIBUTES.Bought, bought);
		}
		const prompt = promptOf(machine);
		if (prompt === undefined || def === undefined) {
			continue;
		}
		const action = line !== undefined ? machineAction(line, stage - 1) : undefined;
		prompt.Enabled = action !== undefined && action.kind !== "locked";
		prompt.ObjectText = def.name;
		if (action?.kind === "buy") {
			prompt.ActionText = `Купити за ${formatMoney(action.price)}`;
		} else if (action?.kind === "deposit") {
			prompt.ActionText = "Скинути руду із сумки";
		} else {
			prompt.ActionText = "Покращення";
		}
	}
	const running = line !== undefined && line.machines.size() > 0 && !isLineIdle(line);
	for (const conveyor of plot.conveyors) {
		if (conveyor.GetAttribute(PLOT_ATTRIBUTES.ConveyorOn) !== running) {
			conveyor.SetAttribute(PLOT_ATTRIBUTES.ConveyorOn, running);
		}
	}
}

// ---- prompt actions (server-side Triggered: the engine tells us who pressed it) ----

function buyNext(player: Player, plot: Plot, data: ProfileData): void {
	const result = tryBuyLineMachine(data.line, data.money);
	if (!result.ok) {
		if (result.reason === "not-enough-money") {
			notify(player, "Не вистачає грошей.", "error");
		}
		return;
	}
	// Money and the machine change in the same frame with no yield between: the purchase is atomic.
	data.money = result.money;
	applyBuyLineMachine(data.line);
	markDirty(player);
	refreshPlot(plot, data.line);
	notify(player, `Збудовано: ${result.def.name}!`, "success");
}

function dropOre(player: Player, plot: Plot, data: ProfileData): void {
	const taken = depositOre(data.line, data.bag, ORE_IDS);
	let total = 0;
	for (const [ore, amount] of taken) {
		const oreId = ore as keyof typeof ORES;
		const left = (data.bag[oreId] ?? 0) - amount;
		data.bag[oreId] = left > 0 ? left : undefined;
		total += amount;
	}
	if (total === 0) {
		const empty = ORE_IDS.every((id) => (data.bag[id] ?? 0) <= 0);
		notify(
			player,
			empty ? "Сумка порожня: спершу накопай руди." : "Приймач повний: зачекай, поки лінія розбере руду.",
			"error",
		);
		return;
	}
	markDirty(player);
	refreshPlot(plot, data.line);
	notify(player, `У приймач поїхало ${total} шт. руди.`, "success");
}

function onPrompt(player: Player, plot: Plot, stage: number): void {
	if (!promptLimiter.tryTake(player.UserId, os.clock())) {
		return;
	}
	if (plotOf.get(player) !== plot) {
		notify(player, "Це чужа ділянка.", "error");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined || !isNearMachine(player, plot, stage)) {
		return;
	}
	const action = machineAction(data.line, stage - 1);
	if (action.kind === "buy") {
		buyNext(player, plot, data);
	} else if (action.kind === "deposit") {
		dropOre(player, plot, data);
	}
	// "upgrade" opens the panel on the client; "locked" prompts are disabled.
}

function addPrompts(plot: Plot): void {
	for (const [stage, machine] of plot.machines) {
		const anchor = machine.PrimaryPart ?? machine.FindFirstChildWhichIsA("BasePart", true);
		if (anchor === undefined || promptOf(machine) !== undefined) {
			continue;
		}
		const prompt = new Instance("ProximityPrompt");
		prompt.Name = PROMPT_NAME;
		prompt.RequiresLineOfSight = false;
		prompt.HoldDuration = 0;
		prompt.MaxActivationDistance = LINE_DISTANCE - 4;
		prompt.Enabled = false;
		// A prompt must sit on a part to be shown in the world, so it goes on the machine's main part.
		prompt.Parent = anchor;
		prompt.Triggered.Connect((player) => {
			const [ok, err] = pcall(onPrompt, player, plot, stage);
			if (!ok) {
				warn(`[line] prompt failed: ${err}`);
			}
		});
	}
}

// ---- upgrades (remote from the UI) ----

function handleUpgrade(player: Player, args: Array<unknown>): void {
	const [index, track] = args;
	if (args.size() !== 2 || !isIntegerInRange(index, 0, LINE_MACHINES.size() - 1) || !typeIs(track, "string")) {
		logAbuse(player, "bad UpgradeLineMachine arguments");
		return;
	}
	const plot = plotOf.get(player);
	const data = getProfileData(player);
	if (plot === undefined || data === undefined) {
		return;
	}
	if (!isNearMachine(player, plot, index + 1)) {
		logAbuse(player, "UpgradeLineMachine away from the machine");
		return;
	}
	const result = tryLineUpgrade(data.line, index, track, data.money);
	if (!result.ok) {
		if (result.reason === "not-enough-money") {
			notify(player, "Не вистачає грошей.", "error");
		} else if (result.reason === "unknown") {
			logAbuse(player, "UpgradeLineMachine of a machine not owned or an unknown track");
		}
		return;
	}
	data.money = result.money;
	applyLineUpgrade(data.line, index, track as Parameters<typeof applyLineUpgrade>[2]);
	markDirty(player);
	notify(player, `Покращено до рівня ${result.upgrade.level}!`, "success");
}

// ---- plots ----

function claimPlot(player: Player): Plot | undefined {
	const existing = plotOf.get(player);
	if (existing !== undefined) {
		return existing;
	}
	const free = plots.find((plot) => plot.model.GetAttribute(PLOT_ATTRIBUTES.Owner) === 0);
	if (free === undefined) {
		return undefined;
	}
	free.model.SetAttribute(PLOT_ATTRIBUTES.Owner, player.UserId);
	plotOf.set(player, free);
	return free;
}

function releasePlot(player: Player): void {
	const plot = plotOf.get(player);
	if (plot === undefined) {
		return;
	}
	plotOf.delete(player);
	plot.model.SetAttribute(PLOT_ATTRIBUTES.Owner, 0);
	refreshPlot(plot, undefined);
}

// ---- production ----

function tickPlayer(player: Player, seconds: number): void {
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	data.lastSeen = nowUnix();
	if (isLineIdle(data.line)) {
		return;
	}
	const result = advanceLine(data.line, seconds, valueOf, roll);
	credit(player, data, result.money);
	markDirty(player);
	const plot = plotOf.get(player);
	if (plot !== undefined) {
		refreshPlot(plot, data.line);
	}
}

function onLoaded(player: Player): void {
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	// Offline run: the time since the last save, at reduced speed and capped (config/line.ts).
	if (data.lastSeen > 0) {
		const result = advanceOffline(data.line, nowUnix() - data.lastSeen, valueOf, roll);
		const income = credit(player, data, result.money);
		if (income > 0) {
			notify(player, `Поки тебе не було, лінія заробила ${formatMoney(income)}.`, "success");
		}
	}
	data.lastSeen = nowUnix();
	markDirty(player);
	const plot = claimPlot(player);
	if (plot === undefined) {
		notify(player, "Вільних ділянок немає: лінія працює, але приймач недоступний.", "error");
		return;
	}
	refreshPlot(plot, data.line);
}

export function startLineService(): void {
	plots = loadPlots();
	for (const plot of plots) {
		plot.model.SetAttribute(PLOT_ATTRIBUTES.Owner, 0);
		addPrompts(plot);
		refreshPlot(plot, undefined);
	}
	onClientRequest(UPGRADE_LINE_MACHINE_REMOTE, new RateLimiter(6, 3), handleUpgrade);
	onProfileLoaded(onLoaded);
	onProfileReleasing((player) => {
		const data = getProfileData(player);
		if (data !== undefined) {
			data.lastSeen = nowUnix();
		}
	});
	Players.PlayerRemoving.Connect(releasePlot);

	task.spawn(() => {
		let last = os.clock();
		for (;;) {
			task.wait(TICK_SECONDS);
			const now = os.clock();
			const seconds = now - last;
			last = now;
			for (const player of getLoadedPlayers()) {
				const [ok, err] = pcall(tickPlayer, player, seconds);
				if (!ok) {
					warn(`[line] tick failed for ${player.UserId}: ${err}`);
				}
			}
		}
	});
}
