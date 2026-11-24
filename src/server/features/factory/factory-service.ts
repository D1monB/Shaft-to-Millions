import { CollectionService, Workspace } from "@rbxts/services";
import {
	MACHINES,
	MACHINE_IDS,
	MachineId,
	RECIPES,
	WAREHOUSE_CAPACITY,
	isMachineId,
	isRecipeId,
} from "shared/config/machines";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { ORE_IDS } from "shared/config/ores";
import { RESOURCES, RESOURCE_IDS } from "shared/config/resources";
import {
	BUY_MACHINE_REMOTE,
	CANCEL_REMOTE,
	COLLECT_REMOTE,
	DEPOSIT_BAG_REMOTE,
	ENQUEUE_REMOTE,
	FACTORY_DISTANCE,
	MAX_ENQUEUE_PER_REQUEST,
	SELL_WAREHOUSE_REMOTE,
	advance,
	cancelLast,
	collect,
	depositAll,
	enqueue,
	newMachineState,
	storageTotal,
} from "shared/features/factory";
import { ProfileData } from "shared/features/profile";
import { previewSale } from "shared/features/selling";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { isIntegerInRange } from "shared/lib/validate";
import { getLoadedPlayers, getProfileData, markDirty, onProfileLoaded } from "server/features/profile";
import { getSellMultiplier } from "server/features/selling";
import { notify } from "server/lib/notify";
import { ensurePrompt, findNearbyTagged } from "server/lib/proximity";
import { logAbuse, onClientRequest } from "server/lib/remotes";

/** Unix seconds, synced across servers: machine timers survive leaving and joining another server. */
function now(): number {
	return Workspace.GetServerTimeNow();
}

function nearWarehouse(player: Player): boolean {
	return findNearbyTagged(player, TAGS.Warehouse, FACTORY_DISTANCE) !== undefined;
}

function nearMachine(player: Player, machineId: MachineId): boolean {
	const match = (instance: Instance) => instance.GetAttribute(ATTRIBUTES.MachineId) === machineId;
	return findNearbyTagged(player, TAGS.Machine, FACTORY_DISTANCE, match) !== undefined;
}

/** Advances every owned machine. Returns how many crafts finished. */
function advanceAll(data: ProfileData): number {
	let finished = 0;
	const time = now();
	for (const machineId of MACHINE_IDS) {
		const state = data.machines[machineId];
		if (state !== undefined) {
			finished += advance(state, time);
		}
	}
	return finished;
}

// ---------------------------------------------------------------- warehouse

function handleDeposit(player: Player, args: Array<unknown>): void {
	const data = getProfileData(player);
	if (data === undefined || args.size() !== 0) {
		return;
	}
	if (!nearWarehouse(player)) {
		logAbuse(player, "DepositBag away from the warehouse");
		return;
	}
	const moved = depositAll(data.bag, data.warehouse, ORE_IDS, WAREHOUSE_CAPACITY);
	if (moved > 0) {
		markDirty(player);
		notify(player, `На склад: ${moved} шт.`, "success");
	} else if (storageTotal(data.warehouse) >= WAREHOUSE_CAPACITY) {
		notify(player, "Склад повний. Продай або переплав щось.", "error");
	}
}

function handleSellWarehouse(player: Player, args: Array<unknown>): void {
	const data = getProfileData(player);
	if (data === undefined || args.size() !== 0) {
		return;
	}
	if (!nearWarehouse(player)) {
		logAbuse(player, "SellWarehouse away from the warehouse");
		return;
	}
	const preview = previewSale(data.warehouse, RESOURCE_IDS, RESOURCES, getSellMultiplier(player));
	if (preview.itemCount === 0) {
		return;
	}
	// Same frame, no yields: the stock disappears and the money appears together.
	for (const line of preview.lines) {
		data.warehouse[line.id as keyof typeof data.warehouse] = undefined;
	}
	data.money += preview.total;
	data.stats.totalEarned += preview.total;
	markDirty(player);
	notify(player, `Склад продано за ${formatMoney(preview.total)}!`, "success");
}

// ---------------------------------------------------------------- machines

function handleBuyMachine(player: Player, args: Array<unknown>): void {
	const [machineId] = args;
	if (args.size() !== 1 || !isMachineId(machineId)) {
		logAbuse(player, "bad BuyMachine arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined || data.machines[machineId] !== undefined) {
		return; // Already owned: a double click, nothing to do.
	}
	if (!nearMachine(player, machineId)) {
		logAbuse(player, "BuyMachine away from the machine");
		return;
	}
	const price = MACHINES[machineId].price;
	if (data.money < price) {
		notify(player, "Не вистачає грошей.", "error");
		return;
	}
	data.money -= price;
	data.machines[machineId] = newMachineState();
	markDirty(player);
	notify(player, `Куплено: ${MACHINES[machineId].name}!`, "success");
}

/** Shared checks for requests about an owned machine. Returns its state, or undefined to drop the request. */
function ownedMachineNearby(player: Player, data: ProfileData, machineId: unknown, action: string) {
	if (!isMachineId(machineId)) {
		logAbuse(player, `bad ${action} machine id`);
		return undefined;
	}
	const state = data.machines[machineId];
	if (state === undefined) {
		return undefined;
	}
	if (!nearMachine(player, machineId)) {
		logAbuse(player, `${action} away from the machine`);
		return undefined;
	}
	advance(state, now());
	return state;
}

function handleEnqueue(player: Player, args: Array<unknown>): void {
	const [machineId, recipeId, count] = args;
	if (args.size() !== 3 || !isRecipeId(recipeId) || !isIntegerInRange(count, 1, MAX_ENQUEUE_PER_REQUEST)) {
		logAbuse(player, "bad EnqueueCraft arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	const state = ownedMachineNearby(player, data, machineId, "EnqueueCraft");
	if (state === undefined || RECIPES[recipeId].machine !== machineId) {
		return;
	}
	const result = enqueue(
		state,
		data.warehouse,
		recipeId,
		count,
		now(),
		MACHINES[RECIPES[recipeId].machine].queueLimit,
	);
	if (result.ok) {
		markDirty(player);
	} else if (result.reason === "queue-full") {
		notify(player, "Черга повна.", "error");
	} else if (result.reason === "missing-inputs") {
		notify(player, "На складі не вистачає сировини.", "error");
	}
}

function handleCollect(player: Player, args: Array<unknown>): void {
	const data = getProfileData(player);
	if (data === undefined || args.size() !== 1) {
		return;
	}
	const state = ownedMachineNearby(player, data, args[0], "CollectOutput");
	if (state === undefined) {
		return;
	}
	const moved = collect(state, data.warehouse, WAREHOUSE_CAPACITY);
	markDirty(player);
	if (moved > 0) {
		notify(player, `На склад: ${moved} шт.`, "success");
	} else if (storageTotal(state.ready) > 0) {
		notify(player, "Склад повний: звільни місце.", "error");
	}
}

function handleCancel(player: Player, args: Array<unknown>): void {
	const data = getProfileData(player);
	if (data === undefined || args.size() !== 1) {
		return;
	}
	const state = ownedMachineNearby(player, data, args[0], "CancelCraft");
	if (state === undefined) {
		return;
	}
	if (cancelLast(state, data.warehouse, WAREHOUSE_CAPACITY)) {
		markDirty(player);
	} else {
		notify(player, "Нема чого скасувати (або склад повний).", "info");
	}
}

// ---------------------------------------------------------------- lifecycle

const TICK_SECONDS = 2;

export function startFactoryService(): void {
	onClientRequest(DEPOSIT_BAG_REMOTE, new RateLimiter(4, 1), handleDeposit);
	onClientRequest(SELL_WAREHOUSE_REMOTE, new RateLimiter(3, 1), handleSellWarehouse);
	onClientRequest(BUY_MACHINE_REMOTE, new RateLimiter(3, 1), handleBuyMachine);
	onClientRequest(ENQUEUE_REMOTE, new RateLimiter(10, 4), handleEnqueue);
	onClientRequest(COLLECT_REMOTE, new RateLimiter(6, 2), handleCollect);
	onClientRequest(CANCEL_REMOTE, new RateLimiter(10, 4), handleCancel);

	const addWarehousePrompt = (instance: Instance) => ensurePrompt(instance, "Відкрити", "Склад");
	CollectionService.GetTagged(TAGS.Warehouse).forEach(addWarehousePrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.Warehouse).Connect(addWarehousePrompt);

	const addMachinePrompt = (instance: Instance) => {
		const machineId = instance.GetAttribute(ATTRIBUTES.MachineId);
		if (isMachineId(machineId)) {
			ensurePrompt(instance, "Відкрити", MACHINES[machineId].name);
		} else {
			warn(`[factory] ${instance.GetFullName()} has tag Machine but no valid MachineId attribute; skipped.`);
		}
	};
	CollectionService.GetTagged(TAGS.Machine).forEach(addMachinePrompt);
	CollectionService.GetInstanceAddedSignal(TAGS.Machine).Connect(addMachinePrompt);

	// Offline progress: everything that finished while the player was away is ready when they return.
	onProfileLoaded((player) => {
		const data = getProfileData(player);
		if (data === undefined) {
			return;
		}
		const finished = advanceAll(data);
		if (finished > 0) {
			notify(player, `Поки тебе не було, фабрика виготовила ${finished} шт.!`, "success");
		}
	});

	// Online progress: finished crafts move to "ready" so the player sees them without reopening the panel.
	task.spawn(() => {
		for (;;) {
			task.wait(TICK_SECONDS);
			for (const player of getLoadedPlayers()) {
				const [ok, err] = pcall(() => {
					const data = getProfileData(player);
					if (data !== undefined && advanceAll(data) > 0) {
						markDirty(player);
					}
				});
				if (!ok) {
					warn(`[factory] tick failed for ${player.UserId}: ${err}`);
				}
			}
		}
	});
}
