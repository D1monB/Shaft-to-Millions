import { CollectionService, Workspace } from "@rbxts/services";
import { DRILLS, drillKey } from "shared/config/drills";
import { LAYER_COUNT, oresOfLayer } from "shared/config/layers";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { ORES, isOreId } from "shared/config/ores";
import {
	BUY_DRILL_REMOTE,
	DRILL_DISTANCE,
	SELECT_DRILL_ORE_REMOTE,
	advanceDrill,
	canDrillOre,
	deliverDrill,
	isDrillUnlocked,
	newDrillState,
	selectDrillOre,
} from "shared/features/drill";
import { getPickaxe } from "shared/features/mining";
import { ProfileData } from "shared/features/profile";
import { RateLimiter } from "shared/lib/rate-limiter";
import { isIntegerInRange } from "shared/lib/validate";
import { getLoadedPlayers, getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
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
		// Conveyor to the line hopper. Whatever does not fit (or no line yet) stays in the drill's buffer.
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
		notify(player, "Не вистачає грошей.", "error");
		return;
	}
	const tier = getPickaxe(data.gear.equipped.pickaxe).tier;
	const firstOre = oresOfLayer(layer).find((oreId) => canDrillOre(layer, oreId, tier));
	if (firstOre === undefined) {
		notify(player, "Твоя кирка не бере жодної руди цього шару.", "error");
		return;
	}
	data.money -= def.price;
	data.drills[drillKey(layer)] = newDrillState(firstOre, now());
	markDirty(player);
	notify(player, `Збудовано: ${def.name}! Конвеєр везе руду в приймач твоєї лінії.`, "success");
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
		notify(player, `${ORES[oreId].name}: потрібна краща кирка.`, "error");
		return;
	}
	tickDrills(data); // count what was produced with the old ore and try to empty the buffer first
	if (selectDrillOre(state, oreId, now())) {
		markDirty(player);
		notify(player, `Бур тепер добуває: ${ORES[oreId].name}.`, "success");
	} else {
		notify(player, "Спершу звільни приймач лінії: у бурі ще лежить руда.", "error");
	}
}

export function startDrillService(): void {
	onClientRequest(BUY_DRILL_REMOTE, new RateLimiter(3, 1), handleBuy);
	onClientRequest(SELECT_DRILL_ORE_REMOTE, new RateLimiter(6, 2), handleSelect);

	const addPrompt = (instance: Instance) => ensurePrompt(instance, "Відкрити", "Автобур");
	CollectionService.GetTagged(TAGS.DrillSite).forEach(addPrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.DrillSite).Connect(addPrompt);

	onProfileLoaded((player) => {
		const data = getProfileData(player);
		if (data === undefined) {
			return;
		}
		const [produced] = tickDrills(data);
		if (produced > 0) {
			notify(player, `Поки тебе не було, бури добули ${produced} шт. руди.`, "success");
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
