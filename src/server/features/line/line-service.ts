// The tycoon line on the server (decisions 027): choosing a plot, building it for its owner, buying machines and
// dropping ore through ProximityPrompts, upgrades through a remote, the production tick and the offline run.
// Everything that moves value happens here; the client sees the result in its view and in the built plot.
import { Players } from "@rbxts/services";
import { LINE_MACHINES } from "shared/config/line";
import { PLOT_ATTRIBUTES } from "shared/config/map-contract";
import { ORES, ORE_IDS, isOreId } from "shared/config/ores";
import {
	LINE_DISTANCE,
	UPGRADE_LINE_MACHINE_REMOTE,
	advanceLine,
	advanceOffline,
	applyBuyLineMachine,
	applyLineUpgrade,
	depositOre,
	isLineIdle,
	lineIncome,
	tryBuyLineMachine,
	tryLineUpgrade,
} from "shared/features/line";
import { ProfileData } from "shared/features/profile";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { MAX_COUNTER } from "shared/lib/repair";
import { isIntegerInRange } from "shared/lib/validate";
import { hasRespawnCamp } from "server/features/layers";
import { resetMovementBaseline } from "server/features/movement";
import {
	getLoadedPlayers,
	getProfileData,
	markDirty,
	onProfileLoaded,
	onProfileReleasing,
} from "server/features/profile";
import { getSellMultiplier } from "server/features/selling";
import { notify } from "server/lib/notify";
import { getRootPosition } from "server/lib/proximity";
import { logAbuse, onClientRequest } from "server/lib/remotes";
import { Plot, buildBase, clearBase, loadPlots, placeMachine, slotCFrame, spawnPosition } from "./plots";

const TICK_SECONDS = 1;
/** How close (studs) to a plot's sign the player must stand to claim it. */
const CLAIM_DISTANCE = 40;

let plots: Plot[] = [];
const plotOf = new Map<Player, Plot>();
const random = new Random();
const promptLimiter = new RateLimiter(8, 4);

const valueOf = (ore: string) => (isOreId(ore) ? ORES[ore].price : undefined);
const roll = () => random.NextNumber();

function nowUnix(): number {
	return os.time();
}

function ownerOf(plot: Plot): number {
	const owner = plot.model.GetAttribute(PLOT_ATTRIBUTES.Owner);
	return typeIs(owner, "number") ? owner : 0;
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

function isNear(player: Player, position: Vector3 | undefined, distance: number): boolean {
	const root = getRootPosition(player);
	return root !== undefined && position !== undefined && position.sub(root).Magnitude <= distance;
}

/** Moves a live character to a position without tripping the movement check. */
function teleport(player: Player, position: Vector3): void {
	const character = player.Character;
	if (character === undefined || character.Parent === undefined) {
		return;
	}
	character.PivotTo(new CFrame(position));
	resetMovementBaseline(player);
}

// ---- invisible anchors for prompts on the plot (the intake and the slot of the next machine) ----

function makeAnchor(parent: Instance, name: string, cframe: CFrame): BasePart {
	const part = new Instance("Part");
	part.Name = name;
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.Transparency = 1;
	part.Size = new Vector3(4, 4, 4);
	part.CFrame = cframe;
	part.Parent = parent;
	return part;
}

/**
 * The intake and the next machine's slot stand at the same place while no machine is bought, so they use different
 * keys and are always both shown (with one key, only the nearest prompt would react).
 */
const DROP_KEYS = { keyboard: Enum.KeyCode.E, gamepad: Enum.KeyCode.ButtonX };
const BUY_KEYS = { keyboard: Enum.KeyCode.F, gamepad: Enum.KeyCode.ButtonY };

function makePrompt(
	parent: Instance,
	action: string,
	object: string,
	keys: { keyboard: Enum.KeyCode; gamepad: Enum.KeyCode },
	onTriggered: (player: Player) => void,
): void {
	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = action;
	prompt.ObjectText = object;
	prompt.KeyboardKeyCode = keys.keyboard;
	prompt.GamepadKeyCode = keys.gamepad;
	prompt.Exclusivity = Enum.ProximityPromptExclusivity.AlwaysShow;
	prompt.RequiresLineOfSight = false;
	prompt.HoldDuration = 0;
	prompt.MaxActivationDistance = LINE_DISTANCE - 4;
	prompt.Parent = parent;
	prompt.Triggered.Connect((player) => {
		if (!promptLimiter.tryTake(player.UserId, os.clock())) {
			return;
		}
		const [ok, err] = pcall(onTriggered, player);
		if (!ok) {
			warn(`[line] prompt failed: ${err}`);
		}
	});
}

/** The slot of the next machine: an invisible anchor at its place with a "buy" prompt. Removed when all are bought. */
function refreshBuySlot(plot: Plot, owned: number): void {
	plot.built?.FindFirstChild("BuySlot")?.Destroy();
	const def = LINE_MACHINES[owned];
	const cframe = slotCFrame(plot, owned + 1);
	if (plot.built === undefined || def === undefined || cframe === undefined) {
		return;
	}
	const slot = makeAnchor(plot.built, "BuySlot", cframe);
	makePrompt(slot, `Купити за ${formatMoney(def.price)}`, def.name, BUY_KEYS, (player) => buyNext(player, plot));
}

/** Builds the plot for its owner: belt and SellStation, every bought machine, the intake and the next slot. */
function buildFor(plot: Plot, data: ProfileData): void {
	const built = buildBase(plot);
	for (let stage = 1; stage <= data.line.machines.size(); stage++) {
		placeMachine(plot, stage);
	}
	// The belt always runs (decisions 027): ore can ride it even before the first machine.
	for (const part of built.GetDescendants()) {
		if (part.IsA("BasePart") && part.GetAttribute("ConveyorFlow") !== undefined) {
			part.SetAttribute(PLOT_ATTRIBUTES.ConveyorOn, true);
		}
	}
	const intakeAt = slotCFrame(plot, 1);
	if (intakeAt !== undefined) {
		const intake = makeAnchor(built, "Intake", intakeAt);
		makePrompt(intake, "Скинути руду із сумки", "Початок стрічки", DROP_KEYS, (player) => dropOre(player, plot));
	}
	refreshBuySlot(plot, data.line.machines.size());
}

// ---- prompt actions (server-side Triggered: the engine tells us who pressed it) ----

/** Common checks for actions on a plot: it is the player's own, the profile is loaded, the player is close. */
function ownData(player: Player, plot: Plot, at: Vector3 | undefined): ProfileData | undefined {
	if (plotOf.get(player) !== plot) {
		notify(player, "Це чужа ділянка.", "error");
		return undefined;
	}
	const data = getProfileData(player);
	return data !== undefined && isNear(player, at, LINE_DISTANCE) ? data : undefined;
}

function buyNext(player: Player, plot: Plot): void {
	const current = getProfileData(player);
	const nextStage = current !== undefined ? current.line.machines.size() + 1 : 0;
	const data = ownData(player, plot, slotCFrame(plot, nextStage)?.Position);
	if (data === undefined) {
		return;
	}
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
	placeMachine(plot, data.line.machines.size());
	refreshBuySlot(plot, data.line.machines.size());
	notify(player, `Збудовано: ${result.def.name}!`, "success");
}

function dropOre(player: Player, plot: Plot): void {
	const data = ownData(player, plot, slotCFrame(plot, 1)?.Position);
	if (data === undefined) {
		return;
	}
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
			empty ? "Сумка порожня: спершу накопай руди." : "Стрічка заповнена: зачекай, поки руда проїде.",
			"error",
		);
		return;
	}
	markDirty(player);
	notify(player, `На стрічку поїхало ${total} шт. руди.`, "success");
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
	if (!isNear(player, slotCFrame(plot, index + 1)?.Position, LINE_DISTANCE)) {
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

// ---- plots: claim, release, spawn ----

function claimAnchor(plot: Plot): BasePart {
	const sign = plot.model.FindFirstChild("Sign");
	return sign !== undefined && sign.IsA("BasePart") ? sign : plot.base;
}

function setClaimPromptEnabled(plot: Plot, enabled: boolean): void {
	const prompt = claimAnchor(plot).FindFirstChild("ClaimPrompt");
	if (prompt !== undefined && prompt.IsA("ProximityPrompt")) {
		prompt.Enabled = enabled;
	}
}

function claim(player: Player, plot: Plot): void {
	const data = getProfileData(player);
	if (data === undefined || ownerOf(plot) !== 0 || !isNear(player, claimAnchor(plot).Position, CLAIM_DISTANCE)) {
		return;
	}
	if (plotOf.has(player)) {
		notify(player, "У тебе вже є ділянка.", "error");
		return;
	}
	plot.model.SetAttribute(PLOT_ATTRIBUTES.Owner, player.UserId);
	plotOf.set(player, plot);
	setClaimPromptEnabled(plot, false);
	// A broken template must not leave the plot owned and half built: undo the claim and let anyone retry.
	const [built, err] = pcall(buildFor, plot, data);
	if (!built) {
		warn(`[line] building ${plot.model.Name} failed: ${err}`);
		releasePlot(player);
		notify(player, "Не вдалося збудувати ділянку, спробуй іншу.", "error");
		return;
	}
	notify(player, "Ділянка твоя! Кидай руду на стрічку або купи першу машину.", "success");
}

function addClaimPrompt(plot: Plot): void {
	const prompt = new Instance("ProximityPrompt");
	prompt.Name = "ClaimPrompt";
	prompt.ActionText = "Зайняти ділянку";
	prompt.ObjectText = `Ділянка ${tostring(plot.model.GetAttribute(PLOT_ATTRIBUTES.PlotIndex) ?? "")}`;
	prompt.RequiresLineOfSight = false;
	prompt.HoldDuration = 0.5;
	prompt.MaxActivationDistance = CLAIM_DISTANCE - 5;
	prompt.Parent = claimAnchor(plot);
	prompt.Triggered.Connect((player) => {
		if (!promptLimiter.tryTake(player.UserId, os.clock())) {
			return;
		}
		const [ok, err] = pcall(claim, player, plot);
		if (!ok) {
			warn(`[line] claim failed: ${err}`);
		}
	});
}

function releasePlot(player: Player): void {
	const plot = plotOf.get(player);
	if (plot === undefined) {
		return;
	}
	plotOf.delete(player);
	plot.model.SetAttribute(PLOT_ATTRIBUTES.Owner, 0);
	clearBase(plot);
	setClaimPromptEnabled(plot, true);
}

/** Where the player appears: their own plot, or else the first free one (to take it or walk to another). */
function spawnFor(player: Player): Vector3 | undefined {
	const own = plotOf.get(player);
	if (own !== undefined) {
		return spawnPosition(own);
	}
	const free = plots.find((plot) => ownerOf(plot) === 0);
	return free !== undefined ? spawnPosition(free) : undefined;
}

function onCharacterAdded(player: Player): void {
	// A player with an opened camp respawns there (layers feature); everyone else at a plot.
	if (hasRespawnCamp(player) || getProfileData(player) === undefined) {
		return;
	}
	task.defer(() => {
		const position = spawnFor(player);
		if (position !== undefined) {
			teleport(player, position);
		}
	});
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
	// The first character spawned before the profile loaded: put it on a free plot now.
	const position = spawnFor(player);
	if (position === undefined) {
		notify(player, "Вільних ділянок немає: лінія працює, але кидати руду ніде.", "error");
		return;
	}
	teleport(player, position);
	notify(player, "Обери ділянку: підійди до таблички й натисни E.", "info");
}

export function startLineService(): void {
	plots = loadPlots();
	for (const plot of plots) {
		plot.model.SetAttribute(PLOT_ATTRIBUTES.Owner, 0);
		addClaimPrompt(plot);
	}
	onClientRequest(UPGRADE_LINE_MACHINE_REMOTE, new RateLimiter(6, 3), handleUpgrade);
	onProfileLoaded(onLoaded);
	onProfileReleasing((player) => {
		const data = getProfileData(player);
		if (data !== undefined) {
			data.lastSeen = nowUnix();
		}
	});
	const watch = (player: Player) => player.CharacterAdded.Connect(() => onCharacterAdded(player));
	Players.PlayerAdded.Connect(watch);
	Players.GetPlayers().forEach(watch);
	Players.PlayerRemoving.Connect((player) => {
		releasePlot(player);
		promptLimiter.forget(player.UserId);
	});

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
