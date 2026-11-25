// Drill panel and depth/speed HUD stats. The panel explains WHY a drill is locked, what it produces,
// and how it compares with mining by hand, so automation never looks like a replacement for the pickaxe.
import React from "@rbxts/react";
import { DRILLS, drillKey } from "shared/config/drills";
import { LAYERS, LAYER_COUNT, oresOfLayer } from "shared/config/layers";
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
import { intakeRoom } from "shared/features/line";
import { getPickaxe, hitsRequired } from "shared/features/mining";
import { walkSpeedFor } from "shared/features/movement";
import { PlayerView } from "shared/features/profile";
import { formatCount, formatMoney } from "shared/lib/format";
import { deepCopy } from "shared/lib/tables";
import { registerGoalSource } from "client/features/goals";
import { registerHudStat } from "client/features/hud";
import { useView } from "client/features/profile";
import { useServerClock } from "client/lib/hooks";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import { BuyButton, Button, COLORS, Card, Label, ProgressBar, TEXT_SIZES } from "client/lib/ui-kit";

let speedBonusOf: (view: PlayerView) => number = () => 0;

/** Equipment sets this so the HUD shows the same speed the server applies. */
export function setClientSpeedBonus(provider: (view: PlayerView) => number): void {
	speedBonusOf = provider;
}

function DrillShop(props: { layer: number; view: PlayerView }) {
	const def = DRILLS[props.layer];
	if (def === undefined) {
		return undefined;
	}
	const tier = getPickaxe(props.view.gear.equipped.pickaxe).tier;
	return (
		<>
			<Label
				text="Автобур добуває руду цього шару сам і везе її конвеєром на стрічку твоєї ділянки, навіть коли тебе немає (до 8 год)."
				tone="muted"
				order={1}
			/>
			<Card order={2}>
				{oresOfLayer(props.layer).map((oreId, index) => {
					const allowed = canDrillOre(props.layer, oreId, tier);
					return (
						<Label
							key={oreId}
							text={
								allowed
									? `${ORES[oreId].name}: 1 шт. за ${secondsPerPiece(props.layer, oreId)} с`
									: `🔒 ${ORES[oreId].name}: потрібна краща кирка`
							}
							tone={allowed ? "normal" : "danger"}
							order={index}
						/>
					);
				})}
			</Card>
			<BuyButton
				price={def.price}
				money={props.view.money}
				verb="Збудувати"
				onClick={() => sendToServer(BUY_DRILL_REMOTE, props.layer)}
				order={3}
			/>
		</>
	);
}

function DrillPanel(props: { layer: number }) {
	const view = useView();
	const now = useServerClock(1);
	const layer = props.layer;
	const def = DRILLS[layer];
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	if (def === undefined) {
		return <Label text="На цьому шарі буру немає." tone="muted" />;
	}
	const layerName = LAYERS[layer]?.name ?? `${layer}`;
	const nextName = LAYERS[layer + 1]?.name ?? "наступного шару";
	if (!isDrillUnlocked(layer, view.deepestLayer)) {
		return (
			<>
				<Label text={`🔒 Бур відкриється, коли пройдеш шар «${layerName}».`} display={true} order={1} />
				<Label text={`Дійди до табору шару «${nextName}».`} tone="muted" order={2} />
			</>
		);
	}
	const saved = view.drills[drillKey(layer)];
	if (saved === undefined) {
		return <DrillShop layer={layer} view={view} />;
	}

	const pickaxe = getPickaxe(view.gear.equipped.pickaxe);
	const state = deepCopy(saved);
	advanceDrill(state, layer, now);
	const ore = ORES[state.oreId];
	const perPiece = secondsPerPiece(layer, state.oreId);
	const manual = hitsRequired(ore.hardness, pickaxe.power) * pickaxe.swingSeconds;
	const blocked = intakeRoom(view.line) <= 0;

	return (
		<>
			<Card order={1} accent={blocked ? COLORS.canyon : COLORS.gold}>
				<Label text={`⚙️ Добуває: ${ore.name}`} display={true} size={TEXT_SIZES.large} order={1} />
				<Label text={`Бур: 1 шт. за ${perPiece} с (~${math.floor(3600 / perPiece)} шт./год)`} order={2} />
				<Label
					text={`Вручну: ~${string.format("%.1f", manual)} с на шматок, без дороги`}
					tone="muted"
					order={3}
				/>
				<ProgressBar progress={state.progress / perPiece} height={16} order={4} />
				<Label
					text={`Буфер: ${formatCount(state.buffer, def.bufferCapacity)}`}
					tone={state.buffer > 0 ? "danger" : "muted"}
					order={5}
				/>
				{blocked && (
					<Label text="Початок стрічки заповнений: бур чекає, поки руда проїде." tone="danger" order={6} />
				)}
			</Card>
			<Label text="Що добувати:" display={true} order={2} />
			{oresOfLayer(layer).map((oreId, index) => {
				const allowed = canDrillOre(layer, oreId, pickaxe.tier);
				const selected = oreId === state.oreId;
				return (
					<Button
						key={oreId}
						text={
							selected
								? `✅ ${ORES[oreId].name}`
								: `${ORES[oreId].name} (${formatMoney(ORES[oreId].price)})`
						}
						variant={selected ? "success" : "secondary"}
						onClick={() => {
							if (!selected) {
								sendToServer(SELECT_DRILL_ORE_REMOTE, layer, oreId);
							}
						}}
						disabled={!allowed && !selected}
						order={10 + index}
					/>
				);
			})}
		</>
	);
}

export function startDrillController(): void {
	onPromptForTag(TAGS.DrillSite, (instance) => {
		const layer = instance.GetAttribute(ATTRIBUTES.LayerId);
		if (typeIs(layer, "number")) {
			openPanel({
				key: `drill_${layer}`,
				title: `Автобур: ${LAYERS[layer]?.name ?? layer}`,
				icon: "⚙️",
				render: () => <DrillPanel layer={layer} />,
			});
		}
	});

	registerHudStat(5, (view) => ({
		icon: "🕳",
		text: `Найглибший шар: ${LAYERS[view.deepestLayer]?.name ?? view.deepestLayer} (${view.deepestLayer}/${LAYER_COUNT})`,
		short: `${view.deepestLayer}/${LAYER_COUNT}`,
	}));
	registerHudStat(25, (view) => {
		const speed = math.floor(walkSpeedFor(view.gear.equipped.shoes, speedBonusOf(view)));
		return { icon: "👟", text: `Швидкість ходьби: ${speed}`, short: `${speed}` };
	});

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
}
