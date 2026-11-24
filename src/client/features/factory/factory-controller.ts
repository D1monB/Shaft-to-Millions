// Warehouse and machine panels. Everything shown is computed from the server's data with the same shared
// functions the server uses; buttons only send intents.
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
import { formatDuration, formatMoney } from "shared/lib/format";
import { deepCopy } from "shared/lib/tables";
import { registerGoalSource } from "client/features/goals";
import { registerHudLine } from "client/features/hud";
import { getView } from "client/features/profile";
import { registerSellPanelExtra } from "client/features/selling";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import {
	THEME,
	isPanelOpen,
	makeButton,
	makeCard,
	makeLabel,
	makeProgressBar,
	openPanel,
	refreshPanel,
} from "client/lib/ui";

let multiplierOf: (view: PlayerView) => number = () => 1;

/** Equipment sets this so warehouse sale previews include pet bonuses. */
export function setFactorySellMultiplier(provider: (view: PlayerView) => number): void {
	multiplierOf = provider;
}

function now(): number {
	return Workspace.GetServerTimeNow();
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

/** The machine as it is RIGHT NOW: the view is advanced locally so timers tick between server updates. */
function liveState(state: MachineState): MachineState {
	const copy = deepCopy(state);
	advance(copy, now());
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

function renderWarehouse(content: ScrollingFrame): void {
	const view = getView();
	if (view === undefined) {
		return;
	}
	const used = storageTotal(view.warehouse);
	const card = makeCard(content);
	makeLabel(card, `📦 Зайнято ${used}/${WAREHOUSE_CAPACITY}`, { bold: true });
	makeProgressBar(card, used / WAREHOUSE_CAPACITY, used >= WAREHOUSE_CAPACITY ? THEME.danger : THEME.accent);
	for (const id of RESOURCE_IDS) {
		const count = view.warehouse[id];
		if (count !== undefined && count > 0) {
			makeLabel(card, `${RESOURCES[id].name}: ${count}`, { color: THEME.muted });
		}
	}

	const inBag = bagTotal(view.bag);
	makeButton(content, `Вивантажити сумку (${inBag} шт.)`, () => sendToServer(DEPOSIT_BAG_REMOTE), inBag > 0);

	const preview = previewSale(view.warehouse, RESOURCE_IDS, RESOURCES, multiplierOf(view));
	if (preview.itemCount > 0) {
		const estimate = simulateProcessing(view.warehouse, ownedRecipes(view));
		if (estimate.crafts > 0) {
			makeLabel(
				content,
				`Якщо спершу переробити на твоїх машинах: ~${formatMoney(estimate.valueAfter)} (≈${formatDuration(estimate.seconds)})`,
				{ color: THEME.success },
			);
		}
		makeButton(content, `Продати все зі складу за ${formatMoney(preview.total)}`, () =>
			sendToServer(SELL_WAREHOUSE_REMOTE),
		);
	}
}

// ---------------------------------------------------------------- machine panel

let openMachine: MachineId | undefined;

function renderMachine(content: ScrollingFrame): void {
	const view = getView();
	const machineId = openMachine;
	if (view === undefined || machineId === undefined) {
		return;
	}
	const def = MACHINES[machineId];
	const saved = view.machines[machineId];

	if (saved === undefined) {
		makeLabel(content, def.description, { color: THEME.muted });
		const card = makeCard(content);
		makeLabel(card, "Рецепти:", { bold: true });
		for (const recipeId of recipesOf(machineId)) {
			const recipe = RECIPES[recipeId];
			makeLabel(card, `${amountsText(recipe.inputs)} → ${amountsText(recipe.outputs)} (${recipe.seconds} с)`);
		}
		const affordable = view.money >= def.price;
		makeButton(
			content,
			affordable
				? `Купити за ${formatMoney(def.price)}`
				: `${formatMoney(def.price)} (бракує ${formatMoney(def.price - view.money)})`,
			() => sendToServer(BUY_MACHINE_REMOTE, machineId),
			affordable,
		);
		return;
	}

	const state = liveState(saved);
	const progress = machineProgress(state, now());

	// Current process
	const processCard = makeCard(content);
	makeLabel(processCard, `Черга: ${state.queue.size()}/${def.queueLimit}`, { bold: true });
	if (progress.current !== undefined) {
		makeLabel(
			processCard,
			`Зараз: ${amountsText(RECIPES[progress.current].outputs)} · ще ${formatDuration(progress.secondsLeft)}`,
		);
		makeProgressBar(processCard, progress.fraction);
		makeLabel(processCard, `Уся черга буде готова через ${formatDuration(progress.totalSecondsLeft)}`, {
			color: THEME.muted,
		});
	} else {
		makeLabel(processCard, "Машина простоює. Додай рецепт нижче.", { color: THEME.muted });
	}
	if (state.queue.size() >= 2) {
		makeButton(processCard, "Скасувати останній у черзі", () => sendToServer(CANCEL_REMOTE, machineId));
	}

	// Ready output
	const readyTotal = storageTotal(state.ready);
	if (readyTotal > 0) {
		const readyCard = makeCard(content);
		makeLabel(readyCard, `Готово: ${amountsText(state.ready as ResourceAmounts)}`, {
			bold: true,
			color: THEME.success,
		});
		makeButton(readyCard, "Забрати на склад", () => sendToServer(COLLECT_REMOTE, machineId));
	}

	// Recipes
	const room = def.queueLimit - state.queue.size();
	for (const recipeId of recipesOf(machineId)) {
		const recipe = RECIPES[recipeId];
		const card = makeCard(content);
		makeLabel(card, `${amountsText(recipe.inputs)} → ${amountsText(recipe.outputs)}`, { bold: true });
		const have: string[] = [];
		for (const [id, need] of pairs(recipe.inputs)) {
			have.push(`${RESOURCES[id].name} ${view.warehouse[id] ?? 0}/${need}`);
		}
		makeLabel(card, `На складі: ${have.join(", ")}`, { color: THEME.muted });
		makeLabel(
			card,
			`${recipe.seconds} с · сировина ${formatMoney(amountsValue(recipe.inputs))} → товар ${formatMoney(amountsValue(recipe.outputs))}`,
			{ color: THEME.success },
		);
		const possible = math.min(maxCrafts(view.warehouse as Counts, recipeId), room);
		makeButton(card, "+1", () => sendToServer(ENQUEUE_REMOTE, machineId, recipeId, 1), possible >= 1);
		makeButton(card, "+5", () => sendToServer(ENQUEUE_REMOTE, machineId, recipeId, 5), possible >= 5);
	}
}

// ---------------------------------------------------------------- wiring

function hudSummary(view: PlayerView): string | undefined {
	let working = 0;
	let ready = 0;
	let owned = 0;
	for (const machineId of MACHINE_IDS) {
		const saved = view.machines[machineId];
		if (saved !== undefined) {
			owned += 1;
			const state = liveState(saved);
			working += state.queue.size();
			ready += storageTotal(state.ready);
		}
	}
	if (owned === 0) {
		return undefined;
	}
	return `🏭 В роботі: ${working} · готово: ${ready}`;
}

export function startFactoryController(): void {
	onPromptForTag(TAGS.Warehouse, () => openPanel("warehouse", "Склад", renderWarehouse));
	onPromptForTag(TAGS.Machine, (instance) => {
		const machineId = instance.GetAttribute(ATTRIBUTES.MachineId);
		if (isMachineId(machineId)) {
			openMachine = machineId;
			openPanel(`machine_${machineId}`, MACHINES[machineId].name, renderMachine);
		}
	});

	registerHudLine(30, (view) => `📦 Склад: ${storageTotal(view.warehouse)}/${WAREHOUSE_CAPACITY}`);
	registerHudLine(40, hudSummary);

	registerGoalSource((view) => {
		const nextMachine = MACHINE_IDS.find((id) => view.machines[id] === undefined);
		return nextMachine === undefined
			? []
			: [{ label: MACHINES[nextMachine].name, price: MACHINES[nextMachine].price, priority: 1 }];
	});

	registerSellPanelExtra((content, view) => {
		const owned = ownedRecipes(view);
		const recipes = owned.size() > 0 ? owned : recipesOf("furnace");
		const estimate = simulateProcessing(view.bag as Counts, recipes);
		if (estimate.crafts === 0) {
			return;
		}
		const card = makeCard(content);
		makeLabel(card, "🏭 А якщо переробити?", { bold: true });
		makeLabel(
			card,
			`Зараз: ${formatMoney(estimate.valueBefore)} · після переробки: ~${formatMoney(estimate.valueAfter)} (≈${formatDuration(estimate.seconds)} роботи)`,
			{ color: THEME.success },
		);
		if (owned.size() === 0) {
			makeLabel(card, `Для цього потрібен ${MACHINES.furnace.name} (${formatMoney(MACHINES.furnace.price)}).`, {
				color: THEME.muted,
			});
		} else {
			makeLabel(card, "Віднеси руду на склад і запусти машини.", { color: THEME.muted });
		}
	});

	// Live timers: while a machine panel is open, redraw it twice a second.
	task.spawn(() => {
		for (;;) {
			task.wait(0.5);
			if (openMachine !== undefined && isPanelOpen(`machine_${openMachine}`)) {
				refreshPanel();
			}
		}
	});
}
