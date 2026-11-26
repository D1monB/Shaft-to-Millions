// The tycoon line on the server (decisions 027): choosing a plot, building it for its owner, buying machines and
// dropping ore through ProximityPrompts, upgrades through a remote, the production tick and the offline run.
// Everything that moves value happens here; the client sees the result in its view and in the built plot.
import { CollectionService, Players, ReplicatedStorage, ServerStorage } from "@rbxts/services";
import { LINE_MACHINES } from "shared/config/line";
import { PLOT_ATTRIBUTES, PLOT_SIGN } from "shared/config/map-contract";
import { ORES, ORE_IDS, OreId, isOreId } from "shared/config/ores";
import {
	ITEM_TEMPLATES_FOLDER,
	LABEL_HEIGHT_ATTRIBUTE,
	LINE_DISTANCE,
	LINE_FLOW_REMOTE,
	LineMove,
	UPGRADE_BELT_REMOTE,
	UPGRADE_LINE_MACHINE_REMOTE,
	UPGRADE_POINT_TAG,
	advanceLine,
	advanceOffline,
	applyBuyLineMachine,
	applyLineUpgrade,
	depositOre,
	isLineIdle,
	lineIncome,
	tryBeltUpgrade,
	tryBuyLineMachine,
	tryLineUpgrade,
} from "shared/features/line";
import { Text, nameKeys, ref, text } from "shared/features/i18n";
import { ProfileData } from "shared/features/profile";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { MAX_COUNTER } from "shared/lib/repair";
import { isIntegerInRange } from "shared/lib/validate";
import { hasRespawnCamp } from "server/features/layers";
import { teleportCharacter } from "server/features/movement";
import {
	getLoadedPlayers,
	getProfileData,
	markDirty,
	onProfileLoaded,
	onProfileReleasing,
} from "server/features/profile";
import { boostOf } from "server/features/boosters";
import { trackQuest } from "server/features/quests";
import { getSellMultiplier } from "server/features/selling";
import { notify } from "server/lib/notify";
import { localizeLabel, localizePrompt } from "server/lib/localized";
import { getRootPosition } from "server/lib/proximity";
import { declareUnreliableClientEvent, logAbuse, onClientRequest } from "server/lib/remotes";
import { buildSign } from "./buy-signs";
import { placeIntakeBooth } from "./intake-booth";
import { refreshSellStation, setupSellStation } from "./sell-station";
import { Silo, findSilo, refreshSilo } from "./silo";
import {
	Plot,
	beltStartCFrame,
	buildBase,
	clearBase,
	loadPlots,
	placeMachine,
	signCFrame,
	slotCFrame,
	spawnPosition,
} from "./plots";

const TICK_SECONDS = 1;
/** How close (studs) to a plot's spawn point the player must stand to claim it. */
const CLAIM_DISTANCE = 40;
const CLAIM_POINT = "ClaimPoint";

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
		trackQuest(player, "earnMoney", income);
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
	teleportCharacter(player, position);
}

/**
 * A machine appears where its buyer is standing, and would knock them over. Moves everyone inside its footprint to
 * just outside it. The footprint is taken as a circle: the map author's models are rotated, so their box axes do not
 * line up with the world.
 */
function clearOfMachine(machine: Model): void {
	const [box, size] = machine.GetBoundingBox();
	const radius = math.max(size.X, size.Y, size.Z) / 2 + 2;
	for (const player of Players.GetPlayers()) {
		const root = getRootPosition(player);
		if (root === undefined) {
			continue;
		}
		const offset = new Vector3(root.X - box.Position.X, 0, root.Z - box.Position.Z);
		if (offset.Magnitude >= radius) {
			continue;
		}
		const direction = offset.Magnitude > 0.1 ? offset.Unit : new Vector3(1, 0, 0);
		const side = box.Position.add(direction.mul(radius + 3));
		teleport(player, new Vector3(side.X, root.Y + 1, side.Z));
	}
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

/** Opens the upgrade panel. A third key: machine 1 stands at the start of the belt, next to the drop prompt. */
const UPGRADE_KEYS = { keyboard: Enum.KeyCode.R, gamepad: Enum.KeyCode.ButtonR1 };

/** Runs a plot action for a player: rate limited, and a failure is logged instead of breaking the connection. */
function guarded(player: Player, action: (player: Player) => void): void {
	if (!promptLimiter.tryTake(player.UserId, os.clock())) {
		return;
	}
	const [ok, err] = pcall(action, player);
	if (!ok) {
		warn(`[line] prompt failed: ${err}`);
	}
}

function makePrompt(
	parent: Instance,
	action: Text,
	object: Text,
	keys: { keyboard: Enum.KeyCode; gamepad: Enum.KeyCode },
	onTriggered?: (player: Player) => void,
): ProximityPrompt {
	const prompt = new Instance("ProximityPrompt");
	localizePrompt(prompt, action, object);
	prompt.KeyboardKeyCode = keys.keyboard;
	prompt.GamepadKeyCode = keys.gamepad;
	prompt.Exclusivity = Enum.ProximityPromptExclusivity.AlwaysShow;
	prompt.RequiresLineOfSight = false;
	prompt.HoldDuration = 0;
	prompt.MaxActivationDistance = LINE_DISTANCE - 4;
	prompt.Parent = parent;
	if (onTriggered !== undefined) {
		prompt.Triggered.Connect((player) => guarded(player, onTriggered));
	}
	return prompt;
}

const UPGRADE_POINTS_FOLDER = "UpgradePoints";
/** The progress bar never hangs higher than this: some machines are 30 studs tall, out of view from the ground. */
const MAX_LABEL_HEIGHT = 12;

/**
 * The world height of the highest visible point of a model. Not GetBoundingBox: that box is turned with the model's
 * pivot, and the map author's models are rotated by 90 degrees, so its "height" is a horizontal size.
 */
function topOf(model: Model): number {
	let top = -math.huge;
	for (const part of model.GetDescendants()) {
		if (part.IsA("BasePart") && part.Transparency < 1) {
			const { XVector, YVector, ZVector } = part.CFrame;
			const size = part.Size;
			const half =
				(math.abs(XVector.Y) * size.X + math.abs(YVector.Y) * size.Y + math.abs(ZVector.Y) * size.Z) / 2;
			top = math.max(top, part.Position.Y + half);
		}
	}
	return top === -math.huge ? model.GetPivot().Position.Y : top;
}

/**
 * The point at a bought machine: its prompt opens the upgrade panel and the progress bar hangs above it. The server
 * does nothing on the press (the client opens the panel); a level is bought through the UpgradeLineMachine remote.
 */
function addUpgradePoint(plot: Plot, stage: number, machine: Model): void {
	const cframe = slotCFrame(plot, stage);
	const def = LINE_MACHINES[stage - 1];
	if (plot.built === undefined || cframe === undefined || def === undefined) {
		return;
	}
	let folder = plot.built.FindFirstChild(UPGRADE_POINTS_FOLDER);
	if (folder === undefined) {
		folder = new Instance("Folder");
		folder.Name = UPGRADE_POINTS_FOLDER;
		folder.Parent = plot.built;
	}
	const anchor = makeAnchor(folder, `UpgradePoint_${stage}`, cframe);
	const above = math.max(topOf(machine) - cframe.Position.Y, 0) + 1.5;
	anchor.SetAttribute(LABEL_HEIGHT_ATTRIBUTE, math.min(above, MAX_LABEL_HEIGHT));
	anchor.SetAttribute(PLOT_ATTRIBUTES.Stage, stage);
	const prompt = makePrompt(anchor, text("line.upgrade"), text(nameKeys.machine(def.id)), UPGRADE_KEYS);
	// Machines stand close together: show only the nearest upgrade prompt.
	prompt.Exclusivity = Enum.ProximityPromptExclusivity.OnePerButton;
	CollectionService.AddTag(anchor, UPGRADE_POINT_TAG);
}

const SIGNS_FOLDER = "BuySigns";

/** Where a player must stand to buy machine `stage`: at its sign, or at its place if no sign could be put. */
function buyPoint(plot: Plot, stage: number): Vector3 | undefined {
	return (signCFrame(plot, stage) ?? slotCFrame(plot, stage))?.Position;
}

/**
 * A sign beside every machine place that is not bought yet. Only the next one is active: F (gamepad Y), a click or
 * a tap buys it. Rebuilt after every purchase (at most 12 small models).
 */
function refreshSigns(plot: Plot, owned: number): void {
	plot.built?.FindFirstChild(SIGNS_FOLDER)?.Destroy();
	if (plot.built === undefined) {
		return;
	}
	const folder = new Instance("Folder");
	folder.Name = SIGNS_FOLDER;
	folder.Parent = plot.built;
	for (let index = owned; index < LINE_MACHINES.size(); index++) {
		const def = LINE_MACHINES[index];
		const stage = index + 1;
		const at = signCFrame(plot, stage);
		const active = index === owned;
		if (at === undefined) {
			// No belt near this place: keep the old invisible buy point, so the machine can still be bought.
			const cframe = slotCFrame(plot, stage);
			if (active && cframe !== undefined) {
				const slot = makeAnchor(folder, `BuySlot_${stage}`, cframe);
				makePrompt(
					slot,
					text("line.buyFor", { price: formatMoney(def.price) }),
					text(nameKeys.machine(def.id)),
					BUY_KEYS,
					(p) => buyNext(p, plot),
				);
			}
			continue;
		}
		const { board } = buildSign(
			`Sign_${stage}`,
			at,
			{ machineId: def.id, price: formatMoney(def.price), active, requiresId: LINE_MACHINES[index - 1]?.id },
			folder,
		);
		if (!active) {
			continue;
		}
		makePrompt(
			board,
			text("line.buyFor", { price: formatMoney(def.price) }),
			text(nameKeys.machine(def.id)),
			BUY_KEYS,
			(p) => buyNext(p, plot),
		);
		// A click or a tap on the board buys too (phones). The server learns who clicked from the engine, not the client.
		const click = new Instance("ClickDetector");
		click.MaxActivationDistance = LINE_DISTANCE - 4;
		click.Parent = board;
		click.MouseClick.Connect((player) => guarded(player, (p) => buyNext(p, plot)));
	}
}

/** The plain booth on the belt start (no silo on this plot); returns where its drop prompt goes. */
function boothIntake(plot: Plot, built: Folder): CFrame | undefined {
	const start = beltStartCFrame(plot);
	if (start === undefined) {
		return undefined;
	}
	const [box, size] = placeIntakeBooth(built, start).GetBoundingBox();
	return new CFrame(box.Position.sub(new Vector3(0, size.Y / 2 - 3, 0)));
}

/** The silo of each owned plot, for its gauge. */
const silos = new Map<Plot, Silo>();

/** The built SellStation of each owned plot, for its live price board. */
const sellStations = new Map<Plot, Instance>();

/** Builds the plot for its owner: belt and SellStation, every bought machine, the intake and the next slot. */
function buildFor(plot: Plot, data: ProfileData): void {
	const built = buildBase(plot);
	for (let stage = 1; stage <= data.line.machines.size(); stage++) {
		const machine = placeMachine(plot, stage);
		if (machine !== undefined) {
			addUpgradePoint(plot, stage, machine);
		}
	}
	// The belt always runs (decisions 027): ore can ride it even before the first machine.
	for (const part of built.GetDescendants()) {
		if (part.IsA("BasePart") && part.GetAttribute("ConveyorFlow") !== undefined) {
			part.SetAttribute(PLOT_ATTRIBUTES.ConveyorOn, true);
		}
	}
	// Ore is handed in at the map author's silo (decision 047), else at the booth on the belt start (decision 039).
	const silo = findSilo(built);
	const intakeAt = silo !== undefined ? new CFrame(silo.intake) : boothIntake(plot, built);
	if (silo !== undefined) {
		silos.set(plot, silo);
	}
	if (intakeAt !== undefined) {
		const intake = makeAnchor(built, "Intake", intakeAt);
		makePrompt(intake, text("line.dropOre"), text("line.beltStart"), DROP_KEYS, (player) => dropOre(player, plot));
	}
	const station = setupSellStation(built);
	if (station !== undefined) {
		sellStations.set(plot, station);
	}
	refreshSigns(plot, data.line.machines.size());
}

// ---- prompt actions (server-side Triggered: the engine tells us who pressed it) ----

/** Common checks for actions on a plot: it is the player's own, the profile is loaded, the player is close. */
function ownData(player: Player, plot: Plot, at: Vector3 | undefined): ProfileData | undefined {
	if (plotOf.get(player) !== plot) {
		notify(player, text("line.notYours"), "error");
		return undefined;
	}
	const data = getProfileData(player);
	return data !== undefined && isNear(player, at, LINE_DISTANCE) ? data : undefined;
}

function buyNext(player: Player, plot: Plot): void {
	const current = getProfileData(player);
	const nextStage = current !== undefined ? current.line.machines.size() + 1 : 0;
	const data = ownData(player, plot, buyPoint(plot, nextStage));
	if (data === undefined) {
		return;
	}
	const result = tryBuyLineMachine(data.line, data.money);
	if (!result.ok) {
		if (result.reason === "not-enough-money") {
			notify(player, text("common.notEnoughMoney"), "error");
		}
		return;
	}
	// Money and the machine change in the same frame with no yield between: the purchase is atomic.
	data.money = result.money;
	applyBuyLineMachine(data.line);
	markDirty(player);
	const machine = placeMachine(plot, data.line.machines.size());
	if (machine !== undefined) {
		clearOfMachine(machine);
		addUpgradePoint(plot, data.line.machines.size(), machine);
	}
	refreshSigns(plot, data.line.machines.size());
	notify(player, text("line.built", { name: ref(nameKeys.machine(result.def.id)) }), "success");
}

function dropOre(player: Player, plot: Plot): void {
	const intake = plot.built?.FindFirstChild("Intake");
	const data = ownData(player, plot, intake !== undefined && intake.IsA("BasePart") ? intake.Position : undefined);
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
		notify(player, empty ? text("line.bagEmpty") : text("line.beltFull"), "error");
		return;
	}
	markDirty(player);
	notify(player, text("line.dropped", { count: total }), "success");
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
		// Not logged as abuse: an honest player can walk off while the panel is open.
		notify(player, text("line.tooFar"), "error");
		return;
	}
	const result = tryLineUpgrade(data.line, index, track, data.money);
	if (!result.ok) {
		if (result.reason === "not-enough-money") {
			notify(player, text("common.notEnoughMoney"), "error");
		} else if (result.reason === "unknown") {
			logAbuse(player, "UpgradeLineMachine of a machine not owned or an unknown track");
		}
		return;
	}
	data.money = result.money;
	applyLineUpgrade(data.line, index, track as Parameters<typeof applyLineUpgrade>[2]);
	markDirty(player);
	trackQuest(player, "upgradeMachine", 1);
	notify(player, text("line.upgraded", { level: result.upgrade.level }), "success");
}

/** True when the player stands near any machine they own (the conveyor card sits in every machine's panel). */
function isNearOwnMachine(player: Player, plot: Plot, owned: number): boolean {
	for (let stage = 1; stage <= owned; stage++) {
		if (isNear(player, slotCFrame(plot, stage)?.Position, LINE_DISTANCE)) {
			return true;
		}
	}
	return false;
}

function handleBeltUpgrade(player: Player, args: Array<unknown>): void {
	if (args.size() !== 0) {
		logAbuse(player, "bad UpgradeBelt arguments");
		return;
	}
	const plot = plotOf.get(player);
	const data = getProfileData(player);
	if (plot === undefined || data === undefined) {
		return;
	}
	if (!isNearOwnMachine(player, plot, data.line.machines.size())) {
		// Not logged as abuse: an honest player can walk off while the panel is open.
		notify(player, text("line.tooFar"), "error");
		return;
	}
	const result = tryBeltUpgrade(data.line, data.money);
	if (!result.ok) {
		if (result.reason === "not-enough-money") {
			notify(player, text("common.notEnoughMoney"), "error");
		}
		return;
	}
	// Money and level change together, with no yield in between.
	data.money = result.money;
	data.line.beltLevel = result.level;
	markDirty(player);
	trackQuest(player, "upgradeMachine", 1);
	notify(player, text("line.beltUpgraded", { level: result.level }), "success");
}

// ---- hooks for the base feature (decision 063): the line must not import it ----

export interface LineBonus {
	readonly speed: number;
}

let lineBonusOf: (player: Player) => LineBonus | undefined = () => undefined;
export interface PlotAreaInfo {
	readonly base: BasePart;
	readonly spawn: Vector3;
	/** Machine slots (also the ones not bought yet): keep them clear. */
	readonly reserved: ReadonlyArray<Vector3>;
}
type PlotListener = (player: Player, model: Model, area: PlotAreaInfo) => void;
const plotBuiltListeners: PlotListener[] = [];
const plotReleasedListeners: Array<(player: Player) => void> = [];

export function setLineBonusProvider(provider: (player: Player) => LineBonus | undefined): void {
	lineBonusOf = provider;
}

/** Called after a player's plot (with its factory) is built. */
export function onPlotBuilt(listener: PlotListener): void {
	plotBuiltListeners.push(listener);
}

export function onPlotReleased(listener: (player: Player) => void): void {
	plotReleasedListeners.push(listener);
}

// ---- plots: claim, release, spawn ----

/**
 * The invisible point the claim prompt sits on: at the plot's spawn, on the ground. Not on the sign: the map author's
 * signs stand tens of studs high, so a prompt there could never be reached.
 */
function claimAnchor(plot: Plot): BasePart {
	const existing = plot.model.FindFirstChild(CLAIM_POINT);
	if (existing !== undefined && existing.IsA("BasePart")) {
		return existing;
	}
	return makeAnchor(plot.model, CLAIM_POINT, new CFrame(spawnPosition(plot)));
}

function setClaimPromptEnabled(plot: Plot, enabled: boolean): void {
	const prompt = claimAnchor(plot).FindFirstChild("ClaimPrompt");
	if (prompt !== undefined && prompt.IsA("ProximityPrompt")) {
		prompt.Enabled = enabled;
	}
}

/**
 * The map author's name board over the plot (Sign / SurfaceGui / OwnerName) said "Player N" for everyone. It shows
 * the owner's display name, or "Free plot N" in the viewer's language.
 */
function refreshPlotSign(plot: Plot, owner: Player | undefined): void {
	const sign = plot.model.FindFirstChild(PLOT_SIGN.Part);
	for (const label of sign?.GetDescendants() ?? []) {
		if (label.IsA("TextLabel") && label.Name === PLOT_SIGN.Label) {
			const n = tostring(plot.model.GetAttribute(PLOT_ATTRIBUTES.PlotIndex) ?? "");
			localizeLabel(
				label,
				owner !== undefined
					? text("line.plotOwner", { name: owner.DisplayName })
					: text("line.plotFree", { n }),
			);
		}
	}
}

function claim(player: Player, plot: Plot): void {
	const data = getProfileData(player);
	if (data === undefined || ownerOf(plot) !== 0 || !isNear(player, claimAnchor(plot).Position, CLAIM_DISTANCE)) {
		return;
	}
	if (plotOf.has(player)) {
		notify(player, text("line.havePlot"), "error");
		return;
	}
	plot.model.SetAttribute(PLOT_ATTRIBUTES.Owner, player.UserId);
	plotOf.set(player, plot);
	setClaimPromptEnabled(plot, false);
	refreshPlotSign(plot, player);
	// A broken template must not leave the plot owned and half built: undo the claim and let anyone retry.
	const [built, err] = pcall(buildFor, plot, data);
	if (!built) {
		warn(`[line] building ${plot.model.Name} failed: ${err}`);
		releasePlot(player);
		notify(player, text("line.buildFailed"), "error");
		return;
	}
	const reserved: Vector3[] = [];
	for (let stage = 1; stage <= LINE_MACHINES.size(); stage++) {
		const slot = slotCFrame(plot, stage);
		if (slot !== undefined) {
			reserved.push(slot.Position);
		}
	}
	for (const listener of plotBuiltListeners) {
		task.spawn(listener, player, plot.model, { base: plot.base, spawn: spawnPosition(plot), reserved });
	}
	notify(player, text("line.claimed"), "success");
}

function addClaimPrompt(plot: Plot): void {
	const prompt = new Instance("ProximityPrompt");
	prompt.Name = "ClaimPrompt";
	localizePrompt(
		prompt,
		text("line.claim"),
		text("line.plot", { n: tostring(plot.model.GetAttribute(PLOT_ATTRIBUTES.PlotIndex) ?? "") }),
	);
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
	for (const listener of plotReleasedListeners) {
		task.spawn(listener, player);
	}
	plot.model.SetAttribute(PLOT_ATTRIBUTES.Owner, 0);
	clearBase(plot);
	setClaimPromptEnabled(plot, true);
	refreshPlotSign(plot, undefined);
}

/** The spawn point of the player's own plot, or undefined while they have none. */
export function homePositionOf(player: Player): Vector3 | undefined {
	const own = plotOf.get(player);
	return own !== undefined ? spawnPosition(own) : undefined;
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
	const plot = plotOf.get(player);
	const station = plot !== undefined ? sellStations.get(plot) : undefined;
	if (station !== undefined && station.Parent !== undefined) {
		refreshSellStation(station, data, getSellMultiplier(player));
	}
	const silo = plot !== undefined ? silos.get(plot) : undefined;
	if (silo !== undefined && silo.model.Parent !== undefined) {
		refreshSilo(silo, data.line);
	}
	if (isLineIdle(data.line)) {
		return;
	}
	const moves: LineMove[] = [];
	// The line booster (decision 057) runs the line faster while it is on.
	const speed = boostOf(player, "line") * (lineBonusOf(player)?.speed ?? 1);
	const result = advanceLine(data.line, seconds * speed, valueOf, roll, moves);
	credit(player, data, result.money);
	trackQuest(player, "lineSold", result.sold);
	markDirty(player);
	broadcastFlow(player, moves);
}

let flowEvent: UnreliableRemoteEvent | undefined;

/**
 * Tells every client what moved on this player's line, so items can ride the belt on screen. Visuals only: the
 * message may be lost, and clients never send anything back. Ore ids go as their index in ORE_IDS (smaller packets).
 */
function broadcastFlow(player: Player, moves: ReadonlyArray<LineMove>): void {
	const plot = plotOf.get(player);
	const index = plot?.model.GetAttribute(PLOT_ATTRIBUTES.PlotIndex);
	if (flowEvent === undefined || moves.size() === 0 || !typeIs(index, "number")) {
		return;
	}
	const flat: number[] = [];
	for (const move of moves) {
		const oreIndex = ORE_IDS.indexOf(move.ore as OreId);
		if (oreIndex >= 0) {
			flat.push(oreIndex, move.from);
		}
	}
	if (flat.size() > 0) {
		flowEvent.FireAllClients(index, flat);
	}
}

/**
 * The map author keeps the item models in ServerStorage, which clients cannot see. A copy goes to ReplicatedStorage
 * once at start (78 small models), so clients can show them on the belt.
 */
function publishItemTemplates(): void {
	const source = ServerStorage.FindFirstChild(ITEM_TEMPLATES_FOLDER);
	if (source === undefined) {
		warn("[line] ServerStorage.ItemTemplates not found: the belt shows no items");
		return;
	}
	if (ReplicatedStorage.FindFirstChild(ITEM_TEMPLATES_FOLDER) === undefined) {
		const copy = source.Clone();
		// Only the looks go to clients: any script inside a model stays on the server.
		for (const descendant of copy.GetDescendants()) {
			if (descendant.IsA("LuaSourceContainer")) {
				descendant.Destroy();
			}
		}
		copy.Parent = ReplicatedStorage;
	}
}

function onLoaded(player: Player): void {
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	// Offline run: the time since the last save, at reduced speed and capped (config/line.ts).
	if (data.lastSeen > 0) {
		const result = advanceOffline(data.line, nowUnix() - data.lastSeen, valueOf, roll, lineBonusOf(player)?.speed);
		const income = credit(player, data, result.money);
		if (income > 0) {
			notify(player, text("line.offline", { money: formatMoney(income) }), "success");
		}
	}
	data.lastSeen = nowUnix();
	markDirty(player);
	// The first character spawned before the profile loaded: put it on a free plot now.
	const position = spawnFor(player);
	if (position === undefined) {
		notify(player, text("line.noPlots"), "error");
		return;
	}
	teleport(player, position);
	notify(player, text("line.choosePlot"), "info");
}

export function startLineService(): void {
	flowEvent = declareUnreliableClientEvent(LINE_FLOW_REMOTE);
	publishItemTemplates();
	plots = loadPlots();
	for (const plot of plots) {
		plot.model.SetAttribute(PLOT_ATTRIBUTES.Owner, 0);
		addClaimPrompt(plot);
		refreshPlotSign(plot, undefined);
	}
	onClientRequest(UPGRADE_LINE_MACHINE_REMOTE, new RateLimiter(6, 3), handleUpgrade);
	onClientRequest(UPGRADE_BELT_REMOTE, new RateLimiter(4, 2), handleBeltUpgrade);
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
