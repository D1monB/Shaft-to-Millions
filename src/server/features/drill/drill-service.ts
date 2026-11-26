import { nameKeys, ref, text } from "shared/features/i18n";
import { CollectionService, Workspace } from "@rbxts/services";
import { DRILLS, drillKey } from "shared/config/drills";
import { LAYER_COUNT, oresOfLayer } from "shared/config/layers";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { isOreId } from "shared/config/ores";
import {
	BUY_DRILL_REMOTE,
	DRILL_DISTANCE,
	SELECT_DRILL_ORE_REMOTE,
	UPGRADE_DRILL_REMOTE,
	advanceDrill,
	canDrillOre,
	deliverDrill,
	isDrillUnlocked,
	newDrillState,
	selectDrillOre,
	tryUpgradeDrill,
} from "shared/features/drill";
import { getPickaxe } from "shared/features/mining";
import { ProfileData } from "shared/features/profile";
import { RateLimiter } from "shared/lib/rate-limiter";
import { isIntegerInRange } from "shared/lib/validate";
import { getLoadedPlayers, getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
import { trackQuest } from "server/features/quests";
import { notify } from "server/lib/notify";
import { ensurePrompt, findNearbyTagged } from "server/lib/proximity";
import { logAbuse, onClientRequest } from "server/lib/remotes";

function now(): number {
	return Workspace.GetServerTimeNow();
}

function nearDrillSite(player: Player, layer: number): boolean {
	const match = (instance: Instance) => instance.GetAttribute(ATTRIBUTES.LayerId) === layer;
	return findNearbyTagged(player, TAGS.DrillSite, DRILL_DISTANCE, match) !== undefined;
}

/** Produces and delivers for every owned drill. Returns [produced, delivered]. */
function tickDrills(data: ProfileData): [number, number] {
	let produced = 0;
	let delivered = 0;
	const time = now();
	for (let layer = 1; layer <= LAYER_COUNT; layer++) {
		const state = data.drills[drillKey(layer)];
		if (state === undefined) {
			continue;
		}
		produced += advanceDrill(state, layer, time);
		// Conveyor to the line hopper. Whatever does not fit stays in the drill's buffer.
		delivered += deliverDrill(state, data.line);
	}
	return [produced, delivered];
}

function handleBuy(player: Player, args: Array<unknown>): void {
	const [layer] = args;
	if (args.size() !== 1 || !isIntegerInRange(layer, 1, LAYER_COUNT)) {
		logAbuse(player, "bad BuyDrill arguments");
		return;
	}
	const data = getProfileData(player);
	const def = DRILLS[layer];
	if (data === undefined || def === undefined || data.drills[drillKey(layer)] !== undefined) {
		return;
	}
	if (!isDrillUnlocked(layer, data.deepestLayer)) {
		logAbuse(player, "BuyDrill before passing the layer");
		return;
	}
	if (!nearDrillSite(player, layer)) {
		logAbuse(player, "BuyDrill away from the drill site");
		return;
	}
	if (data.money < def.price) {
		notify(player, text("common.notEnoughMoney"), "error");
		return;
	}
	const tier = getPickaxe(data.gear.equipped.pickaxe).tier;
	const firstOre = oresOfLayer(layer).find((oreId) => canDrillOre(layer, oreId, tier));
	if (firstOre === undefined) {
		notify(player, text("drill.pickaxeTooWeak"), "error");
		return;
	}
	data.money -= def.price;
	data.drills[drillKey(layer)] = newDrillState(firstOre, now());
	markDirty(player);
	notify(player, text("drill.built", { name: ref(nameKeys.drill(layer)) }), "success");
}

function handleSelect(player: Player, args: Array<unknown>): void {
	const [layer, oreId] = args;
	if (args.size() !== 2 || !isIntegerInRange(layer, 1, LAYER_COUNT) || !isOreId(oreId)) {
		logAbuse(player, "bad SelectDrillOre arguments");
		return;
	}
	const data = getProfileData(player);
	const state = data?.drills[drillKey(layer)];
	if (data === undefined || state === undefined) {
		return;
	}
	if (!nearDrillSite(player, layer)) {
		logAbuse(player, "SelectDrillOre away from the drill site");
		return;
	}
	if (!canDrillOre(layer, oreId, getPickaxe(data.gear.equipped.pickaxe).tier)) {
		notify(player, text("drill.needPickaxe", { ore: ref(nameKeys.ore(oreId)) }), "error");
		return;
	}
	tickDrills(data); // count what was produced with the old ore and try to empty the buffer first
	if (selectDrillOre(state, oreId, now())) {
		markDirty(player);
		notify(player, text("drill.selected", { ore: ref(nameKeys.ore(oreId)) }), "success");
	} else {
		notify(player, text("drill.clearFirst"), "error");
	}
}

function handleUpgrade(player: Player, args: Array<unknown>): void {
	const [layer] = args;
	if (args.size() !== 1 || !isIntegerInRange(layer, 1, LAYER_COUNT)) {
		logAbuse(player, "bad UpgradeDrill arguments");
		return;
	}
	const data = getProfileData(player);
	const state = data?.drills[drillKey(layer)];
	if (data === undefined || state === undefined) {
		return;
	}
	if (!nearDrillSite(player, layer)) {
		logAbuse(player, "UpgradeDrill away from the drill site");
		return;
	}
	// Count production at the old speed first, so the new level never applies to time already passed.
	tickDrills(data);
	const result = tryUpgradeDrill(state, layer, data.money);
	if (!result.ok) {
		if (result.reason === "not-enough-money") {
			notify(player, text("common.notEnoughMoney"), "error");
		}
		return;
	}
	data.money = result.money;
	state.level = result.level;
	markDirty(player);
	trackQuest(player, "upgradeMachine", 1);
	notify(player, text("drill.upgraded", { level: result.level }), "success");
}

export function startDrillService(): void {
	onClientRequest(UPGRADE_DRILL_REMOTE, new RateLimiter(4, 2), handleUpgrade);
	onClientRequest(BUY_DRILL_REMOTE, new RateLimiter(3, 1), handleBuy);
	onClientRequest(SELECT_DRILL_ORE_REMOTE, new RateLimiter(6, 2), handleSelect);

	const addPrompt = (instance: Instance) => ensurePrompt(instance, text("common.open"), text("drill.prompt"));
	CollectionService.GetTagged(TAGS.DrillSite).forEach(addPrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.DrillSite).Connect(addPrompt);

	onProfileLoaded((player) => {
		const data = getProfileData(player);
		if (data === undefined) {
			return;
		}
		const [produced] = tickDrills(data);
		if (produced > 0) {
			notify(player, text("drill.offline", { count: produced }), "success");
		}
	});

	task.spawn(() => {
		for (;;) {
			task.wait(2);
			for (const player of getLoadedPlayers()) {
				const [ok, err] = pcall(() => {
					const data = getProfileData(player);
					if (data === undefined) {
						return;
					}
					const [produced, delivered] = tickDrills(data);
					if (produced > 0 || delivered > 0) {
						markDirty(player);
					}
				});
				if (!ok) {
					warn(`[drill] tick failed for ${player.UserId}: ${err}`);
				}
			}
		}
	});
}
