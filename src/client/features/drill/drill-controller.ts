// Drill panel and depth/speed HUD lines. The panel explains WHY a drill is locked, what it produces,
// and how it compares with mining by hand, so automation never looks like a replacement for the pickaxe.
import { Workspace } from "@rbxts/services";
import { DRILLS, drillKey } from "shared/config/drills";
import { LAYERS, LAYER_COUNT, oresOfLayer } from "shared/config/layers";
import { WAREHOUSE_CAPACITY } from "shared/config/machines";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { ORES } from "shared/config/ores";
import {
	BUY_DRILL_REMOTE,
	SELECT_DRILL_ORE_REMOTE,
	advanceDrill,
	canDrillOre,
	isDrillUnlocked,
	secondsPerPiece,
} from "shared/features/drill";
import { storageTotal } from "shared/features/factory";
import { getPickaxe, hitsRequired } from "shared/features/mining";
import { walkSpeedFor } from "shared/features/movement";
import { PlayerView } from "shared/features/profile";
import { formatMoney } from "shared/lib/format";
import { deepCopy } from "shared/lib/tables";
import { registerGoalSource } from "client/features/goals";
import { registerHudLine } from "client/features/hud";
import { getView } from "client/features/profile";
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

let speedBonusOf: (view: PlayerView) => number = () => 0;

/** Equipment sets this so the HUD shows the same speed the server applies. */
export function setClientSpeedBonus(provider: (view: PlayerView) => number): void {
	speedBonusOf = provider;
}

let openLayer: number | undefined;

function renderDrill(content: ScrollingFrame): void {
	const view = getView();
	const layer = openLayer;
	if (view === undefined || layer === undefined) {
		return;
	}
	const def = DRILLS[layer];
	if (def === undefined) {
		makeLabel(content, "На цьому шарі буру немає.");
		return;
	}
	const layerName = LAYERS[layer]?.name ?? `${layer}`;
	const nextName = LAYERS[layer + 1]?.name ?? "наступного шару";
	const saved = view.drills[drillKey(layer)];

	if (!isDrillUnlocked(layer, view.deepestLayer)) {
		makeLabel(content, `🔒 Бур відкриється, коли пройдеш шар «${layerName}».`, { bold: true });
		makeLabel(content, `Дійди до табору шару «${nextName}».`, { color: THEME.muted });
		return;
	}

	const tier = getPickaxe(view.levels.pickaxe).tier;
	const pickaxe = getPickaxe(view.levels.pickaxe);

	if (saved === undefined) {
		makeLabel(
			content,
			"Автобур добуває руду цього шару сам і везе її конвеєром на склад, навіть коли тебе немає (до 8 год).",
			{
				color: THEME.muted,
			},
		);
		const card = makeCard(content);
		for (const oreId of oresOfLayer(layer)) {
			const allowed = canDrillOre(layer, oreId, tier);
			makeLabel(
				card,
				allowed
					? `${ORES[oreId].name}: 1 шт. за ${secondsPerPiece(layer, oreId)} с`
					: `🔒 ${ORES[oreId].name}: потрібна краща кирка`,
				{ color: allowed ? THEME.text : THEME.danger },
			);
		}
		const affordable = view.money >= def.price;
		makeButton(
			content,
			affordable
				? `Збудувати за ${formatMoney(def.price)}`
				: `${formatMoney(def.price)} (бракує ${formatMoney(def.price - view.money)})`,
			() => sendToServer(BUY_DRILL_REMOTE, layer),
			affordable,
		);
		return;
	}

	const state = deepCopy(saved);
	advanceDrill(state, layer, Workspace.GetServerTimeNow());
	const ore = ORES[state.oreId];
	const perPiece = secondsPerPiece(layer, state.oreId);
	const manual = hitsRequired(ore.hardness, pickaxe.power) * pickaxe.swingSeconds;

	const status = makeCard(content);
	makeLabel(status, `Добуває: ${ore.name}`, { bold: true, size: 18 });
	makeLabel(status, `Бур: 1 шт. за ${perPiece} с (~${math.floor(3600 / perPiece)} шт./год)`);
	makeLabel(status, `Вручну: ~${string.format("%.1f", manual)} с на шматок, без дороги`, { color: THEME.muted });
	makeProgressBar(status, state.progress / perPiece);
	makeLabel(status, `Буфер: ${state.buffer}/${def.bufferCapacity}`, {
		color: state.buffer > 0 ? THEME.danger : THEME.muted,
	});
	if (storageTotal(view.warehouse) >= WAREHOUSE_CAPACITY) {
		makeLabel(status, "Склад повний: конвеєр стоїть, бур скоро зупиниться.", { color: THEME.danger });
	}

	makeLabel(content, "Що добувати:", { bold: true });
	for (const oreId of oresOfLayer(layer)) {
		const allowed = canDrillOre(layer, oreId, tier);
		const label =
			oreId === state.oreId ? `✔ ${ORES[oreId].name}` : `${ORES[oreId].name} (${formatMoney(ORES[oreId].price)})`;
		makeButton(
			content,
			label,
			() => sendToServer(SELECT_DRILL_ORE_REMOTE, layer, oreId),
			allowed && oreId !== state.oreId,
		);
	}
}

export function startDrillController(): void {
	onPromptForTag(TAGS.DrillSite, (instance) => {
		const layer = instance.GetAttribute(ATTRIBUTES.LayerId);
		if (typeIs(layer, "number")) {
			openLayer = layer;
			openPanel(`drill_${layer}`, `Автобур: ${LAYERS[layer]?.name ?? layer}`, renderDrill);
		}
	});

	registerHudLine(
		5,
		(view) =>
			`🕳 Найглибше: ${LAYERS[view.deepestLayer]?.name ?? view.deepestLayer} (${view.deepestLayer}/${LAYER_COUNT})`,
	);
	registerHudLine(25, (view) => `👟 Швидкість ${math.floor(walkSpeedFor(view.levels.shoes, speedBonusOf(view)))}`);

	registerGoalSource((view) => {
		for (let layer = 1; layer <= LAYER_COUNT; layer++) {
			const def = DRILLS[layer];
			if (
				def !== undefined &&
				isDrillUnlocked(layer, view.deepestLayer) &&
				view.drills[drillKey(layer)] === undefined
			) {
				return [{ label: def.name, price: def.price, priority: 1 }];
			}
		}
		return [];
	});

	task.spawn(() => {
		for (;;) {
			task.wait(1);
			if (openLayer !== undefined && isPanelOpen(`drill_${openLayer}`)) {
				refreshPanel();
			}
		}
	});
}
