// Warehouse and machine panels, plus progress boards above machines in the world.
// Everything shown is computed from the server's data with the same shared functions the server uses;
// buttons only send intents.
import React from "@rbxts/react";
import { Workspace } from "@rbxts/services";
import {
	MACHINES,
	MACHINE_IDS,
	MachineId,
	RECIPES,
	RecipeId,
	ResourceAmounts,
	WAREHOUSE_CAPACITY,
	isMachineId,
	recipesOf,
} from "shared/config/machines";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { RESOURCES, RESOURCE_IDS } from "shared/config/resources";
import { bagTotal } from "shared/features/bag";
import {
	BUY_MACHINE_REMOTE,
	CANCEL_REMOTE,
	COLLECT_REMOTE,
	Counts,
	DEPOSIT_BAG_REMOTE,
	ENQUEUE_REMOTE,
	MachineState,
	SELL_WAREHOUSE_REMOTE,
	advance,
	machineProgress,
	maxCrafts,
	simulateProcessing,
	storageTotal,
} from "shared/features/factory";
import { PlayerView } from "shared/features/profile";
import { previewSale } from "shared/features/selling";
import { formatCount, formatDuration, formatMoney } from "shared/lib/format";
import { deepCopy } from "shared/lib/tables";
import { registerGoalSource } from "client/features/goals";
import { registerHudStat } from "client/features/hud";
import { useView } from "client/features/profile";
import { registerSellPanelExtra } from "client/features/selling";
import { useServerClock } from "client/lib/hooks";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import {
	BuyButton,
	Button,
	ButtonRow,
	COLORS,
	Card,
	Label,
	ProgressBar,
	TEXT_SIZES,
	rowItemWidth,
} from "client/lib/ui-kit";

let multiplierOf: (view: PlayerView) => number = () => 1;

/** Equipment sets this so warehouse sale previews include pet bonuses. */
export function setFactorySellMultiplier(provider: (view: PlayerView) => number): void {
	multiplierOf = provider;
}

function amountsText(amounts: ResourceAmounts): string {
	const parts: string[] = [];
	for (const id of RESOURCE_IDS) {
		const amount = amounts[id];
		if (amount !== undefined) {
			parts.push(`${amount} ${RESOURCES[id].name}`);
		}
	}
	return parts.join(" + ");
}

function amountsValue(amounts: ResourceAmounts): number {
	let value = 0;
	for (const [id, amount] of pairs(amounts)) {
		value += RESOURCES[id].price * amount;
	}
	return value;
}

/** The machine as it is at `now`: the view is advanced locally so timers tick between server updates. */
export function liveState(state: MachineState, now: number): MachineState {
	const copy = deepCopy(state);
	advance(copy, now);
	return copy;
}

function ownedRecipes(view: PlayerView): RecipeId[] {
	const result: RecipeId[] = [];
	for (const machineId of MACHINE_IDS) {
		if (view.machines[machineId] !== undefined) {
			for (const recipeId of recipesOf(machineId)) {
				result.push(recipeId);
			}
		}
	}
	return result;
}

// ---------------------------------------------------------------- warehouse panel

function WarehousePanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	const used = storageTotal(view.warehouse);
	const full = used >= WAREHOUSE_CAPACITY;
	const inBag = bagTotal(view.bag);
	const preview = previewSale(view.warehouse, RESOURCE_IDS, RESOURCES, multiplierOf(view));
	const estimate = preview.itemCount > 0 ? simulateProcessing(view.warehouse, ownedRecipes(view)) : undefined;

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
					progress={used / WAREHOUSE_CAPACITY}
					color={full ? COLORS.canyon : COLORS.gold}
					text={formatCount(used, WAREHOUSE_CAPACITY)}
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
		</>
	);
}

// ---------------------------------------------------------------- machine panel

function MachineShop(props: { machineId: MachineId; view: PlayerView }) {
	const def = MACHINES[props.machineId];
	return (
		<>
			<Label text={def.description} tone="muted" order={1} />
			<Card order={2}>
				<Label text="Рецепти:" display={true} order={0} />
				{recipesOf(props.machineId).map((recipeId, index) => {
					const recipe = RECIPES[recipeId];
					return (
						<Label
							key={recipeId}
							text={`${amountsText(recipe.inputs)} → ${amountsText(recipe.outputs)} (${recipe.seconds} с)`}
							order={index + 1}
						/>
					);
				})}
			</Card>
			<BuyButton
				price={def.price}
				money={props.view.money}
				verb="Купити"
				onClick={() => sendToServer(BUY_MACHINE_REMOTE, props.machineId)}
				order={3}
			/>
		</>
	);
}

function RecipeCard(props: {
	machineId: MachineId;
	recipeId: RecipeId;
	view: PlayerView;
	room: number;
	order: number;
}) {
	const recipe = RECIPES[props.recipeId];
	const have: string[] = [];
	for (const [id, need] of pairs(recipe.inputs)) {
		have.push(`${RESOURCES[id].name} ${props.view.warehouse[id] ?? 0}/${need}`);
	}
	const possible = math.min(maxCrafts(props.view.warehouse as Counts, props.recipeId), props.room);
	const enqueue = (count: number) => sendToServer(ENQUEUE_REMOTE, props.machineId, props.recipeId, count);
	return (
		<Card order={props.order}>
			<Label text={`${amountsText(recipe.inputs)} → ${amountsText(recipe.outputs)}`} display={true} order={1} />
			<Label text={`На складі: ${have.join(", ")}`} tone="muted" order={2} />
			<Label
				text={`⏱ ${recipe.seconds} с · ${formatMoney(amountsValue(recipe.inputs))} → ${formatMoney(amountsValue(recipe.outputs))}`}
				tone="success"
				order={3}
			/>
			<ButtonRow count={2} order={4}>
				<Button
					text="+1"
					onClick={() => enqueue(1)}
					disabled={possible < 1}
					width={rowItemWidth(2)}
					order={1}
				/>
				<Button
					text="+5"
					onClick={() => enqueue(5)}
					disabled={possible < 5}
					width={rowItemWidth(2)}
					order={2}
				/>
			</ButtonRow>
		</Card>
	);
}

function MachinePanel(props: { machineId: MachineId }) {
	const view = useView();
	const now = useServerClock(0.5);
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	const machineId = props.machineId;
	const def = MACHINES[machineId];
	const saved = view.machines[machineId];
	if (saved === undefined) {
		return <MachineShop machineId={machineId} view={view} />;
	}

	const state = liveState(saved, now);
	const progress = machineProgress(state, now);
	const readyTotal = storageTotal(state.ready);
	const room = def.queueLimit - state.queue.size();

	return (
		<>
			<Card order={1}>
				<Label text={`Черга: ${formatCount(state.queue.size(), def.queueLimit)}`} display={true} order={1} />
				{progress.current !== undefined ? (
					<>
						<Label text={`Зараз: ${amountsText(RECIPES[progress.current].outputs)}`} order={2} />
						<ProgressBar
							progress={progress.fraction}
							text={`ще ${formatDuration(progress.secondsLeft)}`}
							height={20}
							order={3}
						/>
						<Label
							text={`Уся черга буде готова через ${formatDuration(progress.totalSecondsLeft)}`}
							tone="muted"
							order={4}
						/>
					</>
				) : (
					<Label text="💤 Машина простоює. Додай рецепт нижче." tone="muted" order={2} />
				)}
				{state.queue.size() >= 2 && (
					<Button
						text="Скасувати останній у черзі"
						variant="secondary"
						onClick={() => sendToServer(CANCEL_REMOTE, machineId)}
						order={5}
					/>
				)}
			</Card>
			{readyTotal > 0 && (
				<Card order={2} accent={COLORS.success}>
					<Label
						text={`✅ Готово: ${amountsText(state.ready as ResourceAmounts)}`}
						tone="success"
						display={true}
						order={1}
					/>
					<Button
						text="Забрати на склад"
						variant="success"
						onClick={() => sendToServer(COLLECT_REMOTE, machineId)}
						order={2}
					/>
				</Card>
			)}
			{recipesOf(machineId).map((recipeId, index) => (
				<RecipeCard
					key={recipeId}
					machineId={machineId}
					recipeId={recipeId}
					view={view}
					room={room}
					order={10 + index}
				/>
			))}
		</>
	);
}

/** Opens the panel of a machine (also used by the world boards). */
export function openMachinePanel(machineId: MachineId): void {
	openPanel({
		key: `machine_${machineId}`,
		title: MACHINES[machineId].name,
		icon: "🏭",
		render: () => <MachinePanel machineId={machineId} />,
	});
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
	const estimate = simulateProcessing(props.view.bag as Counts, recipes);
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

export function startFactoryController(): void {
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
		return {
			icon: "📦",
			text: formatCount(used, WAREHOUSE_CAPACITY),
			tone: used >= WAREHOUSE_CAPACITY ? "danger" : "normal",
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
			text: `в роботі ${summary.working} · готово ${summary.ready}`,
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
