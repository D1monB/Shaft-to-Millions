// The lift (decision 040): the map author's cage rides the tower between two stops and carries the players standing
// in it. The server moves the cage and the riders (anchored, so the client cannot steer them) and pauses the movement
// check for them; at the end each rider is put down with teleportCharacter, like any server move. Riding down is
// allowed only to an opened layer, so the lift never skips the descent; riding up is always allowed.
import { Players, RunService, Workspace } from "@rbxts/services";
import { LIFT } from "shared/config/map-contract";
import { text } from "shared/features/i18n";
import { LIFT_DISTANCE, mayRide, rideProgress, rideSeconds } from "shared/features/lift";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData } from "server/features/profile";
import { holdCharacter, teleportCharacter } from "server/features/movement";
import { localizePrompt } from "server/lib/localized";
import { notify } from "server/lib/notify";

interface Lift {
	readonly cage: Model;
	/** Cage pivots at the two stops. */
	readonly bottom: CFrame;
	readonly top: CFrame;
	readonly bottomLayer: number | undefined;
	atTop: boolean;
	moving: boolean;
	readonly callPrompts: { readonly bottom: ProximityPrompt; readonly top: ProximityPrompt };
}

interface Rider {
	readonly player: Player;
	readonly character: Model;
	readonly root: BasePart;
	/** Where the character stands inside the cage. */
	readonly offset: CFrame;
}

const promptLimiter = new RateLimiter(2, 1);

function findFolder(): Instance | undefined {
	let current: Instance | undefined = Workspace;
	for (const name of LIFT.Path) {
		current = current?.FindFirstChild(name);
	}
	return current;
}

function bottomOf(model: Model): number {
	const [box, size] = model.GetBoundingBox();
	return box.Position.Y - size.Y / 2;
}

/** The cage pivot that puts the cage's floor on this stop part. */
function pivotAtStop(cage: Model, stop: BasePart): CFrame {
	const pivot = cage.GetPivot();
	const floorBelowPivot = pivot.Position.Y - bottomOf(cage);
	const floorAt = stop.Position.Y - stop.Size.Y / 2;
	return pivot.sub(pivot.Position).add(new Vector3(stop.Position.X, floorAt + floorBelowPivot, stop.Position.Z));
}

function stopPart(folder: Instance, name: string): BasePart | undefined {
	const part = folder.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

function makeAnchor(name: string, at: CFrame, parent: Instance): BasePart {
	const part = new Instance("Part");
	part.Name = name;
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.Transparency = 1;
	part.Size = new Vector3(2, 2, 2);
	part.CFrame = at;
	part.Parent = parent;
	return part;
}

function makePrompt(parent: Instance, action: "lift.ride" | "lift.call", onTriggered: (player: Player) => void) {
	const prompt = new Instance("ProximityPrompt");
	localizePrompt(prompt, text(action), text("lift.name"));
	prompt.Exclusivity = Enum.ProximityPromptExclusivity.AlwaysShow;
	prompt.RequiresLineOfSight = false;
	prompt.HoldDuration = 0;
	prompt.MaxActivationDistance = LIFT_DISTANCE - 2;
	prompt.Parent = parent;
	prompt.Triggered.Connect((player) => {
		if (!promptLimiter.tryTake(player.UserId, os.clock())) {
			return;
		}
		const [ok, err] = pcall(onTriggered, player);
		if (!ok) {
			warn(`[lift] prompt failed: ${err}`);
		}
	});
	return prompt;
}

function rootOf(player: Player): BasePart | undefined {
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	return root !== undefined && root.IsA("BasePart") ? root : undefined;
}

/** Players standing inside the cage right now. */
function ridersIn(cage: Model): Array<Rider> {
	const [box, size] = cage.GetBoundingBox();
	const riders = new Array<Rider>();
	for (const player of Players.GetPlayers()) {
		const character = player.Character;
		const root = rootOf(player);
		if (character === undefined || root === undefined) {
			continue;
		}
		const inCage = box.PointToObjectSpace(root.Position);
		if (
			math.abs(inCage.X) <= size.X / 2 &&
			math.abs(inCage.Z) <= size.Z / 2 &&
			math.abs(inCage.Y) <= size.Y / 2 + 3
		) {
			riders.push({ player, character, root, offset: cage.GetPivot().ToObjectSpace(character.GetPivot()) });
		}
	}
	return riders;
}

function refreshCallPrompts(lift: Lift): void {
	lift.callPrompts.bottom.Enabled = !lift.moving && lift.atTop;
	lift.callPrompts.top.Enabled = !lift.moving && !lift.atTop;
}

/** Moves the cage (and its riders) to the other stop. Returns when it arrives. */
function ride(lift: Lift, riders: ReadonlyArray<Rider>): void {
	lift.moving = true;
	refreshCallPrompts(lift);
	const from = lift.atTop ? lift.top : lift.bottom;
	const to = lift.atTop ? lift.bottom : lift.top;
	const duration = rideSeconds(to.Position.sub(from.Position).Magnitude);
	for (const rider of riders) {
		holdCharacter(rider.player, true);
		rider.root.Anchored = true;
	}
	const started = os.clock();
	// pcall: whatever breaks during the ride, the riders below are always set free and the cage ends at its stop.
	const [ok, err] = pcall(() => {
		let progress = 0;
		while (progress < 1) {
			RunService.Heartbeat.Wait();
			progress = rideProgress(os.clock() - started, duration);
			const pivot = from.Lerp(to, progress);
			lift.cage.PivotTo(pivot);
			for (const rider of riders) {
				if (rider.character.Parent !== undefined) {
					rider.character.PivotTo(pivot.mul(rider.offset));
				}
			}
		}
	});
	if (!ok) {
		warn(`[lift] ride failed: ${err}`);
		lift.cage.PivotTo(to);
	}
	for (const rider of riders) {
		rider.root.Anchored = false;
		holdCharacter(rider.player, false);
		if (rider.character.Parent !== undefined && rider.player.Parent !== undefined) {
			teleportCharacter(rider.player, to.mul(rider.offset).Position);
		}
	}
	lift.atTop = !lift.atTop;
	lift.moving = false;
	refreshCallPrompts(lift);
}

function near(player: Player, position: Vector3): boolean {
	const root = rootOf(player);
	return root !== undefined && root.Position.sub(position).Magnitude <= LIFT_DISTANCE;
}

function onRide(lift: Lift, player: Player): void {
	if (lift.moving) {
		notify(player, text("lift.busy"), "error");
		return;
	}
	const [box] = lift.cage.GetBoundingBox();
	if (!near(player, box.Position) || getProfileData(player) === undefined) {
		return;
	}
	const goingDown = lift.atTop;
	const riders = ridersIn(lift.cage);
	// Everyone aboard must be allowed to go down, or the lift would carry someone past the descent.
	for (const rider of riders) {
		const data = getProfileData(rider.player);
		if (data === undefined || !mayRide(goingDown, lift.bottomLayer, data.deepestLayer)) {
			notify(player, text("lift.locked", { layer: lift.bottomLayer ?? 1 }), "error");
			return;
		}
	}
	if (riders.size() === 0) {
		return;
	}
	ride(lift, riders);
}

/** Brings the empty cage to the stop the player waits at. */
function onCall(lift: Lift, player: Player, toTop: boolean): void {
	if (lift.moving || lift.atTop === toTop) {
		return;
	}
	const waitingAt = toTop ? lift.top : lift.bottom;
	if (!near(player, waitingAt.Position)) {
		return;
	}
	ride(lift, []);
}

export function startLiftService(): void {
	const folder = findFolder();
	const cage = folder?.FindFirstChild(LIFT.Cage);
	const tower = folder?.FindFirstChild(LIFT.Tower);
	if (folder === undefined || cage === undefined || !cage.IsA("Model")) {
		warn("[lift] no lift cage on the map; the lift is off");
		return;
	}
	for (const part of cage.GetDescendants()) {
		if (part.IsA("BasePart")) {
			part.Anchored = true;
		}
	}
	const start = cage.GetPivot();
	const bottomStop = stopPart(folder, LIFT.Bottom);
	const topStop = stopPart(folder, LIFT.Top);
	const bottom = bottomStop !== undefined ? pivotAtStop(cage, bottomStop) : start;
	let top: CFrame;
	if (topStop !== undefined) {
		top = pivotAtStop(cage, topStop);
	} else if (tower !== undefined && tower.IsA("Model")) {
		// No stop parts yet: ride up until the cage's top meets the tower's top.
		const [cageBox, cageSize] = cage.GetBoundingBox();
		const [towerBox, towerSize] = tower.GetBoundingBox();
		const rise = towerBox.Position.Y + towerSize.Y / 2 - (cageBox.Position.Y + cageSize.Y / 2);
		top = bottom.add(new Vector3(0, math.max(rise, 0), 0));
	} else {
		warn("[lift] no LiftTop part and no tower; the lift is off");
		return;
	}
	if (top.Position.sub(bottom.Position).Magnitude < 1) {
		warn("[lift] the two stops are at the same place; the lift is off");
		return;
	}
	cage.PivotTo(bottom);
	const layerValue = bottomStop?.GetAttribute(LIFT.LayerAttribute);
	const anchors = new Instance("Folder");
	anchors.Name = "LiftPrompts";
	anchors.Parent = folder;
	const callBottom = makeAnchor("CallBottom", bottom, anchors);
	const callTop = makeAnchor("CallTop", top, anchors);
	const lift: Lift = {
		cage,
		bottom,
		top,
		bottomLayer: typeIs(layerValue, "number") ? layerValue : undefined,
		atTop: false,
		moving: false,
		callPrompts: {
			bottom: makePrompt(callBottom, "lift.call", (player) => onCall(lift, player, false)),
			top: makePrompt(callTop, "lift.call", (player) => onCall(lift, player, true)),
		},
	};
	// The ride prompt lives inside the cage, so it travels with it.
	const [box] = cage.GetBoundingBox();
	const rideAnchor = makeAnchor("RidePrompt", new CFrame(box.Position), cage);
	makePrompt(rideAnchor, "lift.ride", (player) => onRide(lift, player));
	refreshCallPrompts(lift);
}
