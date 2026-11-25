// Warehouse panel and the factory wiring (prompts, HUD stats, goals). The machine panel is in machine-panel.tsx.
// Everything shown is computed from the server's data with the same shared functions the server uses;
// buttons only send intents.
import React from "@rbxts/react";
import { Workspace } from "@rbxts/services";
import { MACHINES, MACHINE_IDS, MachineId, isMachineId, recipesOf } from "shared/config/machines";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { RESOURCES, RESOURCE_IDS } from "shared/config/resources";
import { bagTotal } from "shared/features/bag";
import {
	Counts,
	DEPOSIT_BAG_REMOTE,
	SELL_WAREHOUSE_REMOTE,
	UPGRADE_WAREHOUSE_REMOTE,
	nextWarehouseUpgrade,
	simulateProcessing,
	storageTotal,
	warehouseCapacity,
} from "shared/features/factory";
import { PlayerView } from "shared/features/profile";
import { previewSale } from "shared/features/selling";
import { formatCompact, formatCount, formatDuration, formatMoney } from "shared/lib/format";
import { registerGoalSource } from "client/features/goals";
import { registerHudStat } from "client/features/hud";
import { getView, useView } from "client/features/profile";
import { registerSellPanelExtra } from "client/features/selling";
import { playSound } from "client/lib/sounds";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import { BuyButton, Button, COLORS, Card, Label, ProgressBar, TEXT_SIZES } from "client/lib/ui-kit";
import { liveState, ownedRecipes, secondsAtUpgrades } from "./factory-helpers";
import { openMachinePanel } from "./machine-panel";

let multiplierOf: (view: PlayerView) => number = () => 1;

/** Equipment sets this so warehouse sale previews include pet bonuses. */
export function setFactorySellMultiplier(provider: (view: PlayerView) => number): void {
	multiplierOf = provider;
}

// ---------------------------------------------------------------- warehouse panel

function WarehousePanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	const used = storageTotal(view.warehouse);
	const capacity = warehouseCapacity(view.levels.warehouse);
	const full = used >= capacity;
	const inBag = bagTotal(view.bag);
	const warehouseUpgrade = nextWarehouseUpgrade(view.levels.warehouse);
	const preview = previewSale(view.warehouse, RESOURCE_IDS, RESOURCES, multiplierOf(view));
	const estimate =
		preview.itemCount > 0
			? simulateProcessing(view.warehouse, ownedRecipes(view), (recipeId) => secondsAtUpgrades(view, recipeId))
			: undefined;

	const lines: React.Element[] = [];
	RESOURCE_IDS.forEach((id, index) => {
		const count = view.warehouse[id];
		if (count !== undefined && count > 0) {
			lines.push(<Label key={id} text={`${RESOURCES[id].name}: ${count}`} tone="muted" order={10 + index} />);
		}
	});

	return (
		<>
			<Card order={1}>
				<Label text="📦 Зайнято" display={true} order={1} />
				<ProgressBar
					progress={used / capacity}
					color={full ? COLORS.canyon : COLORS.gold}
					text={formatCount(used, capacity)}
					height={20}
					order={2}
				/>
				{lines}
			</Card>
			<Button
				text={`⬇ Вивантажити сумку (${inBag} шт.)`}
				onClick={() => sendToServer(DEPOSIT_BAG_REMOTE)}
				disabled={inBag === 0}
				order={2}
			/>
			{estimate !== undefined && estimate.crafts > 0 && (
				<Label
					text={`🏭 Якщо спершу переробити на твоїх машинах: ~${formatMoney(estimate.valueAfter)} (≈${formatDuration(estimate.seconds)})`}
					tone="success"
					order={3}
				/>
			)}
			{preview.itemCount > 0 && (
				<Button
					text={`💰 Продати все за ${formatMoney(preview.total)}`}
					variant="success"
					onClick={() => sendToServer(SELL_WAREHOUSE_REMOTE)}
					order={4}
				/>
			)}
			{warehouseUpgrade !== undefined && (
				<BuyButton
					price={warehouseUpgrade.price}
					money={view.money}
					verb={`Склад до ${warehouseUpgrade.value} місць`}
					onClick={() => sendToServer(UPGRADE_WAREHOUSE_REMOTE)}
					order={5}
				/>
			)}
		</>
	);
}

// ---------------------------------------------------------------- wiring

function factorySummary(view: PlayerView, now: number) {
	let working = 0;
	let ready = 0;
	let owned = 0;
	for (const machineId of MACHINE_IDS) {
		const saved = view.machines[machineId];
		if (saved !== undefined) {
			owned += 1;
			const state = liveState(saved, now);
			working += state.queue.size();
			ready += storageTotal(state.ready);
		}
	}
	return { owned, working, ready };
}

function SellExtra(props: { view: PlayerView }) {
	const owned = ownedRecipes(props.view);
	const recipes = owned.size() > 0 ? owned : recipesOf("furnace");
	const estimate = simulateProcessing(props.view.bag as Counts, recipes, (recipeId) =>
		secondsAtUpgrades(props.view, recipeId),
	);
	if (estimate.crafts === 0) {
		return undefined;
	}
	return (
		<Card accent={COLORS.success}>
			<Label text="🏭 А якщо переробити?" display={true} order={1} />
			<Label
				text={`Зараз: ${formatMoney(estimate.valueBefore)} · після переробки: ~${formatMoney(estimate.valueAfter)} (≈${formatDuration(estimate.seconds)} роботи)`}
				tone="success"
				order={2}
			/>
			<Label
				text={
					owned.size() === 0
						? `Для цього потрібен ${MACHINES.furnace.name} (${formatMoney(MACHINES.furnace.price)}).`
						: "Віднеси руду на склад і запусти машини."
				}
				tone="muted"
				size={TEXT_SIZES.small + 1}
				order={3}
			/>
		</Card>
	);
}

/**
 * Plays a sound when any machine finishes an item. Production runs on timestamps, so the server sends nothing at that
 * moment: the client checks once a second whether the ready count of a machine grew.
 */
function watchMachinesForDone(): void {
	const lastReady = new Map<MachineId, number>();
	task.spawn(() => {
		for (;;) {
			task.wait(1);
			const view = getView();
			if (view === undefined) {
				continue;
			}
			let finished = false;
			for (const id of MACHINE_IDS) {
				const saved = view.machines[id];
				const ready =
					saved === undefined ? 0 : storageTotal(liveState(saved, Workspace.GetServerTimeNow()).ready);
				const before = lastReady.get(id);
				if (before !== undefined && ready > before) {
					finished = true;
				}
				lastReady.set(id, ready);
			}
			if (finished) {
				playSound("machineDone");
			}
		}
	});
}

export function startFactoryController(): void {
	watchMachinesForDone();
	onPromptForTag(TAGS.Warehouse, () =>
		openPanel({ key: "warehouse", title: "Склад", icon: "📦", render: () => <WarehousePanel /> }),
	);
	onPromptForTag(TAGS.Machine, (instance) => {
		const machineId = instance.GetAttribute(ATTRIBUTES.MachineId);
		if (isMachineId(machineId)) {
			openMachinePanel(machineId);
		}
	});

	registerHudStat(30, (view) => {
		const used = storageTotal(view.warehouse);
		const capacity = warehouseCapacity(view.levels.warehouse);
		return {
			icon: "📦",
			text: `Склад: ${formatCount(used, capacity)}`,
			short: `${formatCompact(used)}/${formatCompact(capacity)}`,
			tone: used >= capacity ? "danger" : "normal",
		};
	});
	// The HUD re-renders on server updates (every collect, enqueue, sale), which is often enough here.
	registerHudStat(40, (view) => {
		const summary = factorySummary(view, Workspace.GetServerTimeNow());
		if (summary.owned === 0) {
			return undefined;
		}
		return {
			icon: "🏭",
			text: `Фабрика: в роботі ${summary.working} · готово ${summary.ready}`,
			short: summary.ready > 0 ? `✅ ${summary.ready}` : `${summary.working}`,
			tone: summary.ready > 0 ? "success" : "normal",
		};
	});

	registerGoalSource((view) => {
		const nextMachine = MACHINE_IDS.find((id) => view.machines[id] === undefined);
		if (nextMachine === undefined) {
			return [];
		}
		// The first machine is a target of the first 10 minutes (pickaxe, sell, first furnace), so it ranks as high as
		// a pickaxe that unlocks ore. Later machines are ordinary purchases.
		const ownsNothing = MACHINE_IDS.every((id) => view.machines[id] === undefined);
		return [
			{ label: MACHINES[nextMachine].name, price: MACHINES[nextMachine].price, priority: ownsNothing ? 0 : 1 },
		];
	});

	registerSellPanelExtra((view) => <SellExtra view={view} />);
}
