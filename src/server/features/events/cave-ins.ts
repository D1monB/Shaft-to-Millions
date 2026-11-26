// Cave-ins (decision 065): a red warning circle where a miner stands, then rocks fall. Anyone still inside walks
// slower for a few seconds; nothing is ever lost. The server picks the spot and decides who is hit.
import { CollectionService, Debris, Players, TweenService, Workspace } from "@rbxts/services";
import {
	CAVE_IN_CHANCE,
	CAVE_IN_DAMAGE,
	CAVE_IN_MIN_HEALTH,
	CAVE_IN_SLOW,
	CAVE_IN_STUN_SECONDS,
	CAVE_IN_EVERY_SECONDS,
	CAVE_IN_MINING_RADIUS,
	CAVE_IN_RADIUS,
	CAVE_IN_SLOW_SECONDS,
	CAVE_IN_WARNING_SECONDS,
} from "shared/config/events";
import { TAGS } from "shared/config/map-contract";
import { caveInHits } from "shared/features/events";
import { text } from "shared/features/i18n";
import { notify } from "server/lib/notify";
import { getInstancePosition, getRootPosition } from "server/lib/proximity";

const random = new Random();
const stunnedUntil = new Map<Player, number>();
const slowedUntil = new Map<Player, number>();

/** How much of the walk speed a cave-in takes away right now: 1 while stunned, then the slow, else 0. */
export function speedPenalty(player: Player): number {
	const now = os.clock();
	if ((stunnedUntil.get(player) ?? 0) > now) {
		return 1;
	}
	return (slowedUntil.get(player) ?? 0) > now ? CAVE_IN_SLOW : 0;
}

export function forgetSlow(player: Player): void {
	stunnedUntil.delete(player);
	slowedUntil.delete(player);
}

/** Rocks hurt (never to death), stun and then slow (decision 067). */
function hit(player: Player): void {
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	if (humanoid === undefined || humanoid.Health <= 0) {
		return;
	}
	const damage = math.max(0, math.min(CAVE_IN_DAMAGE, humanoid.Health - CAVE_IN_MIN_HEALTH));
	humanoid.TakeDamage(damage);
	const now = os.clock();
	stunnedUntil.set(player, now + CAVE_IN_STUN_SECONDS);
	slowedUntil.set(player, now + CAVE_IN_STUN_SECONDS + CAVE_IN_SLOW_SECONDS);
	const jumpPower = humanoid.JumpPower;
	const jumpHeight = humanoid.JumpHeight;
	humanoid.JumpPower = 0;
	humanoid.JumpHeight = 0;
	task.delay(CAVE_IN_STUN_SECONDS, () => {
		humanoid.JumpPower = jumpPower;
		humanoid.JumpHeight = jumpHeight;
	});
	notify(player, text("events.caveInHit", { damage: math.floor(damage), seconds: CAVE_IN_STUN_SECONDS }), "error");
}

/** Players standing next to an ore block: the ones a cave-in can hit. */
function miners(): Player[] {
	const ores = CollectionService.GetTagged(TAGS.OreNode);
	return Players.GetPlayers().filter((player) => {
		const root = getRootPosition(player);
		return (
			root !== undefined &&
			ores.some((ore) => {
				const at = getInstancePosition(ore);
				return at !== undefined && at.sub(root).Magnitude <= CAVE_IN_MINING_RADIUS;
			})
		);
	});
}

function groundUnder(player: Player, position: Vector3): Vector3 {
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = player.Character !== undefined ? [player.Character] : [];
	const hit = Workspace.Raycast(position, new Vector3(0, -30, 0), params);
	return hit !== undefined ? hit.Position : position.sub(new Vector3(0, 3, 0));
}

function effectPart(size: Vector3, position: Vector3, color: Color3, material: Enum.Material): Part {
	const part = new Instance("Part");
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.Size = size;
	part.Position = position;
	part.Color = color;
	part.Material = material;
	part.Parent = Workspace;
	return part;
}

function dropRocks(centre: Vector3): void {
	for (let i = 0; i < 10; i++) {
		const offset = new Vector3(random.NextNumber(-1, 1), 0, random.NextNumber(-1, 1)).mul(CAVE_IN_RADIUS * 0.8);
		const size = random.NextNumber(1.5, 3.5);
		const rock = effectPart(
			Vector3.one.mul(size),
			centre.add(offset).add(new Vector3(0, random.NextNumber(18, 28), 0)),
			Color3.fromRGB(105, 98, 92),
			Enum.Material.Slate,
		);
		const target = centre.add(offset).add(new Vector3(0, size / 2, 0));
		TweenService.Create(rock, new TweenInfo(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			Position: target,
		}).Play();
		Debris.AddItem(rock, 2.5);
	}
}

function caveIn(target: Player): void {
	const root = getRootPosition(target);
	if (root === undefined) {
		return;
	}
	const centre = groundUnder(target, root);
	const warning = effectPart(
		new Vector3(0.3, CAVE_IN_RADIUS * 2, CAVE_IN_RADIUS * 2),
		centre.add(new Vector3(0, 0.2, 0)),
		Color3.fromRGB(255, 60, 50),
		Enum.Material.Neon,
	);
	warning.Shape = Enum.PartType.Cylinder;
	warning.CFrame = new CFrame(warning.Position).mul(CFrame.Angles(0, 0, math.rad(90)));
	warning.Transparency = 0.55;
	Debris.AddItem(warning, CAVE_IN_WARNING_SECONDS + 0.6);
	notify(target, text("events.caveInWarning"), "error");
	task.wait(CAVE_IN_WARNING_SECONDS);
	dropRocks(centre);
	task.wait(0.4);
	for (const player of Players.GetPlayers()) {
		const at = getRootPosition(player);
		if (at === undefined || math.abs(at.Y - centre.Y) > 12) {
			continue;
		}
		const flat = new Vector3(at.X - centre.X, 0, at.Z - centre.Z).Magnitude;
		if (caveInHits(flat)) {
			hit(player);
		}
	}
}

export function startCaveIns(): void {
	task.spawn(() => {
		for (;;) {
			task.wait(CAVE_IN_EVERY_SECONDS);
			if (random.NextNumber() >= CAVE_IN_CHANCE) {
				continue;
			}
			const candidates = miners();
			if (candidates.size() > 0) {
				const [ok, err] = pcall(caveIn, candidates[random.NextInteger(0, candidates.size() - 1)]);
				if (!ok) {
					warn(`[events] cave-in failed: ${err}`);
				}
			}
		}
	});
}
