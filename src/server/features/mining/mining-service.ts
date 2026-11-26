import { nameKeys, ref, text } from "shared/features/i18n";
import { CollectionService, Players } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { ORES, OreId, isOreId } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { addToBag, bagCapacity, bagFreeSpace } from "shared/features/bag";
import {
	CLICK_DISTANCE,
	MAX_MINING_DISTANCE,
	MINE_HIT_REMOTE,
	parseHitRequest,
	MINE_PROGRESS_REMOTE,
	MiningSession,
	NODE_BROKEN_REMOTE,
	getPickaxe,
	rollCrystals,
	rollYield,
	veinYield,
} from "shared/features/mining";
import { isLayerOpen } from "shared/features/layers";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";
import { getInstancePosition, getRootPosition } from "server/lib/proximity";
import { declareClientEvent, fireClient, logAbuse, onClientRequest } from "server/lib/remotes";

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
	const pickaxe = PICKAXES.find((candidate) => candidate.tier >= tier);
	return ref(pickaxe !== undefined ? nameKeys.gear(pickaxe.id) : "mining.betterPickaxe");
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
			notify(player, text("mining.bagFull"), "error");
		}
		return;
	}

	const ore = ORES[oreId];
	const result = getSession(player).hit(node, ore, getPickaxe(data.gear.equipped.pickaxe), os.clock());

	if (result.kind === "locked") {
		if (noticeLimiter.tryTake(player.UserId, os.clock())) {
			notify(
				player,
				text("mining.needPickaxe", {
					ore: ref(nameKeys.ore(oreId)),
					pickaxe: pickaxeNameForTier(result.requiredTier),
				}),
				"error",
			);
		}
	} else if (result.kind === "progress") {
		fireClient(MINE_PROGRESS_REMOTE, player, node, result.damage, result.hardness);
	} else if (result.kind === "broken") {
		// A rich vein (decision 046) is marked by the server when it places the block; clients cannot set it.
		const amount = veinYield(
			rollYield(yieldBonusOf(player), random.NextNumber()),
			node.GetAttribute(ATTRIBUTES.Rich) === true,
		);
		const added = addToBag(data.bag, oreId, amount, capacity);
		data.stats.oresMined += added;
		// A rare crystal (decision 043), rolled here with the server Random like the yield.
		const crystals = added > 0 ? rollCrystals(ore.crystalChance, random.NextNumber()) : 0;
		if (crystals > 0) {
			data.crystals += crystals;
			notify(player, text("mining.crystal", { count: crystals }), "success");
		}
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

/**
 * A swing of the pickaxe Tool at a node. The client only names the node; whether it counts (owner of the profile,
 * distance, swing cooldown, pickaxe tier, bag room) is decided in handleHit exactly as for a click.
 */
function handleToolHit(player: Player, args: Array<unknown>): void {
	const request = parseHitRequest(args, isOreNode);
	if (request.kind === "abuse") {
		logAbuse(player, "bad MineHit arguments");
		return;
	}
	if (request.kind === "hit") {
		const oreId = request.node.GetAttribute(ATTRIBUTES.OreId);
		if (isOreId(oreId)) {
			handleHit(player, request.node, oreId);
		}
	}
}

function isOreNode(value: unknown): value is Instance {
	return typeIs(value, "Instance") && CollectionService.HasTag(value, TAGS.OreNode);
}

export function startMiningService(): void {
	declareClientEvent(MINE_PROGRESS_REMOTE);
	// About three swings a second for the fastest pickaxe; the burst forgives network jitter.
	onClientRequest(MINE_HIT_REMOTE, new RateLimiter(8, 5), handleToolHit);
	declareClientEvent(NODE_BROKEN_REMOTE);
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
