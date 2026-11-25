// Machine panel (furnace, workbench): what is cooking now, the queue as slots, ready output, upgrades as level strips,
// and one card per recipe ("ore → ingot") with +1 / +5 / Max buttons. Buttons only send intents; the server checks
// ownership, materials and queue room again.
import React from "@rbxts/react";
import { MACHINES, MACHINE_UPGRADES, MachineId, RECIPES, RecipeId, recipesOf } from "shared/config/machines";
import { RESOURCES } from "shared/config/resources";
import {
	BUY_MACHINE_REMOTE,
	CANCEL_REMOTE,
	COLLECT_REMOTE,
	Counts,
	ENQUEUE_REMOTE,
	MAX_ENQUEUE_PER_REQUEST,
	MachineState,
	UPGRADE_MACHINE_REMOTE,
	craftSeconds,
	machineProgress,
	maxCrafts,
	nextMachineUpgrade,
	queueLimitOf,
	storageTotal,
} from "shared/features/factory";
import { PlayerView } from "shared/features/profile";
import { formatDuration, formatMoney } from "shared/lib/format";
import { useView } from "client/features/profile";
import { useServerClock } from "client/lib/hooks";
import { openPanel } from "client/lib/panels";
import { sendToServer } from "client/lib/remotes";
import { DrawnArrow, ResourceTile } from "client/lib/resource-tile";
import {
	BuyButton,
	Button,
	ButtonRow,
	COLORS,
	Card,
	FONTS,
	Label,
	ProgressBar,
	RADIUS,
	STROKE,
	Stack,
	TEXT_SIZES,
	rowItemWidth,
} from "client/lib/ui-kit";
import { amountsList, amountsValue, liveState } from "./factory-helpers";

const RECIPE_TILE = 56;
const SLOT = 46;
const SLOT_GAP = 6;

// ---------------------------------------------------------------- recipe card

/** Inputs → outputs as tiles. With a view, every input shows "have/need" in green or red. */
function RecipeTiles(props: { recipeId: RecipeId; view?: PlayerView; order?: number }) {
	const recipe = RECIPES[props.recipeId];
	const tiles: React.Element[] = [];
	amountsList(recipe.inputs).forEach((entry, index) => {
		const have = props.view?.warehouse[entry.id] ?? 0;
		tiles.push(
			<ResourceTile
				key={`in_${entry.id}`}
				id={entry.id}
				size={RECIPE_TILE}
				badge={`×${entry.amount}`}
				caption={props.view !== undefined ? `${math.min(have, 9999)}/${entry.amount}` : undefined}
				captionColor={have >= entry.amount ? COLORS.success : COLORS.danger}
				order={index}
			/>,
		);
	});
	tiles.push(<DrawnArrow key="arrow" size={RECIPE_TILE - 16} order={50} />);
	amountsList(recipe.outputs).forEach((entry, index) => {
		tiles.push(
			<ResourceTile
				key={`out_${entry.id}`}
				id={entry.id}
				size={RECIPE_TILE + 8}
				badge={`×${entry.amount}`}
				order={60 + index}
			/>,
		);
	});
	return (
		<Stack direction="horizontal" gap={8} order={props.order}>
			{tiles}
		</Stack>
	);
}

function outputName(recipeId: RecipeId): string {
	const first = amountsList(RECIPES[recipeId].outputs)[0];
	return first === undefined ? "" : RESOURCES[first.id].name;
}

function RecipeCard(props: {
	machineId: MachineId;
	recipeId: RecipeId;
	view: PlayerView;
	room: number;
	speedLevel: number;
	order: number;
}) {
	const recipe = RECIPES[props.recipeId];
	const possible = math.min(maxCrafts(props.view.warehouse as Counts, props.recipeId), props.room);
	const most = math.min(possible, MAX_ENQUEUE_PER_REQUEST);
	const enqueue = (count: number) => sendToServer(ENQUEUE_REMOTE, props.machineId, props.recipeId, count);
	const seconds = craftSeconds(props.recipeId, props.speedLevel);
	return (
		<Card order={props.order} accent={possible > 0 ? COLORS.gold : undefined}>
			<Label text={outputName(props.recipeId)} display={true} size={TEXT_SIZES.large} order={1} />
			<RecipeTiles recipeId={props.recipeId} view={props.view} order={2} />
			<Label
				text={`⏱ ${string.format("%.1f", seconds)} с · було ${formatMoney(amountsValue(recipe.inputs))}, стане ${formatMoney(amountsValue(recipe.outputs))}`}
				tone="success"
				size={TEXT_SIZES.small + 2}
				order={3}
			/>
			{/* The key names the row "Buttons": automated UI checks need a path React's numeric names cannot give. */}
			<ButtonRow key="Buttons" count={3} order={4}>
				<Button
					text="+1"
					onClick={() => enqueue(1)}
					disabled={possible < 1}
					width={rowItemWidth(3)}
					order={1}
				/>
				<Button
					text="+5"
					onClick={() => enqueue(5)}
					disabled={possible < 5}
					width={rowItemWidth(3)}
					order={2}
				/>
				<Button
					text={most > 1 ? `Макс ${most}` : "Макс"}
					variant="success"
					onClick={() => enqueue(most)}
					disabled={most < 1}
					width={rowItemWidth(3)}
					order={3}
				/>
			</ButtonRow>
			{possible < 1 && (
				<Label
					text={props.room < 1 ? "Черга повна." : "Не вистачає ресурсів на складі."}
					tone="muted"
					size={TEXT_SIZES.small + 1}
					order={5}
				/>
			)}
		</Card>
	);
}

// ---------------------------------------------------------------- queue

function EmptySlot(props: { order: number }) {
	return (
		<frame BackgroundColor3={COLORS.black} BackgroundTransparency={0.55} LayoutOrder={props.order}>
			<uicorner CornerRadius={RADIUS.medium} />
			<uistroke Color={COLORS.outline} Thickness={STROKE.thin} Transparency={0.3} />
		</frame>
	);
}

/** The queue as slots: the first one fills up while it cooks, the rest wait, empty slots show the room left. */
function QueueSlots(props: { state: MachineState; limit: number; fraction: number; order: number }) {
	const slots: React.Element[] = [];
	for (let index = 0; index < props.limit; index++) {
		const recipeId = props.state.queue[index];
		const first = recipeId === undefined ? undefined : amountsList(RECIPES[recipeId].outputs)[0];
		slots.push(
			first === undefined ? (
				<EmptySlot key={`slot_${index}`} order={index} />
			) : (
				<ResourceTile
					key={`slot_${index}`}
					id={first.id}
					size={SLOT}
					fill={index === 0 ? props.fraction : undefined}
					dimmed={index > 0}
					order={index}
				/>
			),
		);
	}
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(1, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			LayoutOrder={props.order}
		>
			<uigridlayout
				CellSize={new UDim2(0, SLOT, 0, SLOT)}
				CellPadding={new UDim2(0, SLOT_GAP, 0, SLOT_GAP)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{slots}
		</frame>
	);
}

function NowCard(props: { machineId: MachineId; state: MachineState; now: number; order: number }) {
	const state = props.state;
	const progress = machineProgress(state, props.now);
	const limit = queueLimitOf(props.machineId, state.queueLevel);
	return (
		<Card order={props.order}>
			<Label text={`Черга ${state.queue.size()}/${limit}`} display={true} order={1} />
			<QueueSlots state={state} limit={limit} fraction={progress.fraction} order={2} />
			{progress.current !== undefined ? (
				<>
					<ProgressBar
						progress={progress.fraction}
						text={`${outputName(progress.current)}: ще ${formatDuration(progress.secondsLeft)}`}
						height={22}
						order={3}
					/>
					<Label
						text={`Уся черга буде готова через ${formatDuration(progress.totalSecondsLeft)}`}
						tone="muted"
						size={TEXT_SIZES.small + 1}
						order={4}
					/>
				</>
			) : (
				<Label text="💤 Машина простоює. Додай рецепт нижче." tone="muted" order={3} />
			)}
			{state.queue.size() >= 2 && (
				<Button
					text="Скасувати останній у черзі"
					variant="secondary"
					textSize={TEXT_SIZES.small + 2}
					onClick={() => sendToServer(CANCEL_REMOTE, props.machineId)}
					order={5}
				/>
			)}
		</Card>
	);
}

function ReadyCard(props: { machineId: MachineId; state: MachineState; order: number }) {
	const ready = amountsList(props.state.ready as Counts);
	return (
		<Card order={props.order} accent={COLORS.success}>
			<Label text="✅ Готово!" tone="success" display={true} order={1} />
			<Stack direction="horizontal" gap={8} wrap={true} order={2}>
				{ready.map((entry, index) => (
					<ResourceTile
						key={entry.id}
						id={entry.id}
						size={RECIPE_TILE}
						badge={`×${entry.amount}`}
						order={index}
					/>
				))}
			</Stack>
			<Button
				text="Забрати на склад"
				variant="success"
				shine={true}
				onClick={() => sendToServer(COLLECT_REMOTE, props.machineId)}
				order={3}
			/>
		</Card>
	);
}

// ---------------------------------------------------------------- upgrades

/** Filled pips for bought levels, empty ones for the rest. */
function LevelPips(props: { level: number; levels: number; order: number }) {
	const pips: React.Element[] = [];
	for (let index = 1; index <= props.levels; index++) {
		const bought = index <= props.level;
		pips.push(
			<frame
				key={`pip_${index}`}
				BackgroundColor3={bought ? COLORS.gold : COLORS.black}
				BackgroundTransparency={bought ? 0 : 0.5}
				Size={new UDim2(1 / props.levels, -6, 0, 14)}
				LayoutOrder={index}
			>
				<uicorner CornerRadius={RADIUS.small} />
				<uistroke Color={COLORS.outline} Thickness={STROKE.thin} />
			</frame>,
		);
	}
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 16)} LayoutOrder={props.order}>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				Padding={new UDim(0, 6)}
				SortOrder={Enum.SortOrder.LayoutOrder}
				VerticalAlignment={Enum.VerticalAlignment.Center}
			/>
			{pips}
		</frame>
	);
}

function UpgradeStrip(props: {
	machineId: MachineId;
	state: MachineState;
	view: PlayerView;
	track: "speed" | "queue";
	order: number;
}) {
	const levels = MACHINE_UPGRADES[props.machineId][props.track];
	const level = props.track === "speed" ? props.state.speedLevel : props.state.queueLevel;
	const now = levels[level - 1]?.value ?? 1;
	const upcoming = nextMachineUpgrade(props.machineId, props.state, props.track);
	const title = props.track === "speed" ? `⚡ Швидкість ×${now}` : `📥 Черга: ${now} місць`;
	return (
		<Stack gap={6} order={props.order}>
			<textlabel
				BackgroundTransparency={1}
				Size={new UDim2(1, 0, 0, 24)}
				Font={FONTS.display}
				Text={title}
				TextColor3={COLORS.text}
				TextSize={TEXT_SIZES.body}
				TextXAlignment={Enum.TextXAlignment.Left}
				LayoutOrder={1}
			>
				<uistroke Color={COLORS.outline} Thickness={2} />
			</textlabel>
			<LevelPips level={level} levels={levels.size()} order={2} />
			{upcoming !== undefined ? (
				<BuyButton
					price={upcoming.price}
					money={props.view.money}
					verb={props.track === "speed" ? `До ×${upcoming.value}` : `До ${upcoming.value} місць`}
					textSize={TEXT_SIZES.small + 2}
					onClick={() => sendToServer(UPGRADE_MACHINE_REMOTE, props.machineId, props.track)}
					order={3}
				/>
			) : (
				<Label text="✨ Максимум" tone="success" display={true} order={3} />
			)}
		</Stack>
	);
}

function UpgradeCard(props: { machineId: MachineId; state: MachineState; view: PlayerView; order: number }) {
	return (
		<Card order={props.order} accent={COLORS.gold} gap={14}>
			<Label text="⚙️ Покращення" display={true} size={TEXT_SIZES.large} order={1} />
			<UpgradeStrip {...props} track="speed" order={2} />
			<UpgradeStrip {...props} track="queue" order={3} />
		</Card>
	);
}

// ---------------------------------------------------------------- panel

function MachineShop(props: { machineId: MachineId; view: PlayerView }) {
	const def = MACHINES[props.machineId];
	return (
		<>
			<Label text={def.description} tone="muted" order={1} />
			<Card order={2}>
				<Label text="Що вміє:" display={true} order={0} />
				{recipesOf(props.machineId).map((recipeId, index) => (
					<RecipeTiles key={recipeId} recipeId={recipeId} order={index + 1} />
				))}
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

function MachinePanel(props: { machineId: MachineId }) {
	const view = useView();
	const now = useServerClock(0.5);
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	const machineId = props.machineId;
	const saved = view.machines[machineId];
	if (saved === undefined) {
		return <MachineShop machineId={machineId} view={view} />;
	}
	const state = liveState(saved, now);
	const room = queueLimitOf(machineId, state.queueLevel) - state.queue.size();
	return (
		<>
			{storageTotal(state.ready) > 0 && <ReadyCard key="Ready" machineId={machineId} state={state} order={1} />}
			<NowCard key="Queue" machineId={machineId} state={state} now={now} order={2} />
			{recipesOf(machineId).map((recipeId, index) => (
				<RecipeCard
					key={recipeId}
					machineId={machineId}
					recipeId={recipeId}
					view={view}
					room={room}
					speedLevel={state.speedLevel}
					order={10 + index}
				/>
			))}
			<UpgradeCard key="Upgrades" machineId={machineId} state={state} view={view} order={50} />
		</>
	);
}

/** Opens the panel of a machine (also used by the world boards). */
export function openMachinePanel(machineId: MachineId): void {
	openPanel({
		key: `machine_${machineId}`,
		title: MACHINES[machineId].name,
		icon: machineId === "furnace" ? "🔥" : "🔨",
		render: () => <MachinePanel machineId={machineId} />,
	});
}
