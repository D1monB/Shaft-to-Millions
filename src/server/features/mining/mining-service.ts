import { CollectionService, Players } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { ORES, OreId, isOreId } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { addToBag, bagCapacity, bagFreeSpace } from "shared/features/bag";
import {
	CLICK_DISTANCE,
	MAX_MINING_DISTANCE,
	MINE_PROGRESS_REMOTE,
	MiningSession,
	NODE_BROKEN_REMOTE,
	getPickaxe,
	rollYield,
} from "shared/features/mining";
import { isLayerOpen } from "shared/features/layers";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";
import { getInstancePosition, getRootPosition } from "server/lib/proximity";
import { fireClient, logAbuse } from "server/lib/remotes";

const sessions = new Map<Player, MiningSession<Instance>>();
// Refusal messages ("bag is full") at most every couple of seconds, so clicking does not spam the screen.
const noticeLimiter = new RateLimiter(1, 0.5);
const random = new Random();

let yieldBonusOf: (player: Player) => number = () => 0;

/** Lets the equipment feature add a pickaxe-aura yield bonus without mining depending on it. */
export function setYieldBonusProvider(provider: (player: Player) => number): void {
	yieldBonusOf = provider;
}

function getSession(player: Player): MiningSession<Instance> {
	let session = sessions.get(player);
	if (session === undefined) {
		session = new MiningSession<Instance>();
		sessions.set(player, session);
	}
	return session;
}

function pickaxeNameForTier(tier: number): string {
	return PICKAXES.find((pickaxe) => pickaxe.tier >= tier)?.name ?? "краща кирка";
}

function handleHit(player: Player, node: Instance, oreId: OreId): void {
	const data = getProfileData(player);
	if (data === undefined || !node.IsDescendantOf(game.Workspace)) {
		return;
	}

	// ClickDetector already checks distance, but only roughly; we check again with our own rule.
	const root = getRootPosition(player);
	const target = getInstancePosition(node);
	if (root === undefined || target === undefined) {
		return;
	}
	if (target.sub(root).Magnitude > MAX_MINING_DISTANCE) {
		logAbuse(player, "mining from too far away");
		return;
	}

	if (!isLayerOpen(ORES[oreId].layer, data.deepestLayer)) {
		// Reaching a layer's ore without opening its camp means skipping the descent (teleport).
		logAbuse(player, "mining on a layer that is not opened");
		return;
	}

	const capacity = bagCapacity(data.gear.equipped.bag);
	if (bagFreeSpace(data.bag, capacity) <= 0) {
		if (noticeLimiter.tryTake(player.UserId, os.clock())) {
			notify(player, "Сумка повна! Продай руду або віднеси її на склад.", "error");
		}
		return;
	}

	const ore = ORES[oreId];
	const result = getSession(player).hit(node, ore, getPickaxe(data.gear.equipped.pickaxe), os.clock());

	if (result.kind === "locked") {
		if (noticeLimiter.tryTake(player.UserId, os.clock())) {
			notify(player, `${ore.name}: потрібна ${pickaxeNameForTier(result.requiredTier)}.`, "error");
		}
	} else if (result.kind === "progress") {
		fireClient(MINE_PROGRESS_REMOTE, player, node, result.damage, result.hardness);
	} else if (result.kind === "broken") {
		const amount = rollYield(yieldBonusOf(player), random.NextNumber());
		const added = addToBag(data.bag, oreId, amount, capacity);
		data.stats.oresMined += added;
		markDirty(player);
		fireClient(NODE_BROKEN_REMOTE, player, node, result.respawnSeconds, oreId, added);
	}
	// "cooldown" and "depleted" are normal while clicking fast: silently ignored.
}

const warnedNodes = new Set<Instance>();

function setupNode(node: Instance): void {
	const oreId = node.GetAttribute(ATTRIBUTES.OreId);
	if (!isOreId(oreId)) {
		if (!warnedNodes.has(node)) {
			warnedNodes.add(node);
			warn(`[mining] ${node.GetFullName()} has tag OreNode but no valid OreId attribute; skipped.`);
		}
		return;
	}
	if (!node.IsA("BasePart") && !node.IsA("Model")) {
		return;
	}
	let detector = node.FindFirstChildOfClass("ClickDetector");
	if (detector === undefined) {
		detector = new Instance("ClickDetector");
		detector.Parent = node;
	}
	detector.MaxActivationDistance = CLICK_DISTANCE;
	detector.MouseClick.Connect((player) => handleHit(player, node, oreId));
}

export function startMiningService(): void {
	for (const node of CollectionService.GetTagged(TAGS.OreNode)) {
		setupNode(node);
	}
	CollectionService.GetInstanceAddedSignal(TAGS.OreNode).Connect(setupNode);
	CollectionService.GetInstanceRemovedSignal(TAGS.OreNode).Connect((node) => {
		warnedNodes.delete(node);
		for (const [, session] of sessions) {
			session.forgetNode(node);
		}
	});
	Players.PlayerRemoving.Connect((player) => {
		sessions.delete(player);
		noticeLimiter.forget(player.UserId);
	});
}
