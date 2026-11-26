// Drill panel and depth/speed HUD stats. The panel explains WHY a drill is locked, what it produces,
// and how it compares with mining by hand, so automation never looks like a replacement for the pickaxe.
import React from "@rbxts/react";
import { DRILLS, drillKey } from "shared/config/drills";
import { LAYER_COUNT, oresOfLayer } from "shared/config/layers";
import { nameKeys } from "shared/features/i18n";
import { t } from "client/lib/i18n";
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

function DrillShop(props: { layer: number; view: PlayerView }) {
	const def = DRILLS[props.layer];
	if (def === undefined) {
		return undefined;
	}
	const tier = getPickaxe(props.view.gear.equipped.pickaxe).tier;
	return (
		<>
			<Label text={t("drill.info")} tone="muted" order={1} />
			<Card order={2}>
				{oresOfLayer(props.layer).map((oreId, index) => {
					const allowed = canDrillOre(props.layer, oreId, tier);
					return (
						<Label
							key={oreId}
							text={
								allowed
									? t("drill.orePerPiece", {
											ore: t(nameKeys.ore(oreId)),
											seconds: secondsPerPiece(props.layer, oreId),
										})
									: t("drill.oreLocked", { ore: t(nameKeys.ore(oreId)) })
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
				verb={t("common.build")}
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
		return <Label text={t("common.loading")} tone="muted" />;
	}
	if (def === undefined) {
		return <Label text={t("drill.none")} tone="muted" />;
	}
	const layerName = t(nameKeys.layer(layer));
	const nextName = layer + 1 <= LAYER_COUNT ? t(nameKeys.layer(layer + 1)) : t("drill.nextLayer");
	if (!isDrillUnlocked(layer, view.deepestLayer)) {
		return (
			<>
				<Label text={t("drill.locked", { layer: layerName })} display={true} order={1} />
				<Label text={t("drill.reachCamp", { layer: nextName })} tone="muted" order={2} />
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
				<Label
					text={t("drill.mining", { ore: t(nameKeys.ore(state.oreId)) })}
					display={true}
					size={TEXT_SIZES.large}
					order={1}
				/>
				<Label text={t("drill.rate", { seconds: perPiece, perHour: math.floor(3600 / perPiece) })} order={2} />
				<Label text={t("drill.manual", { seconds: string.format("%.1f", manual) })} tone="muted" order={3} />
				<ProgressBar progress={state.progress / perPiece} height={16} order={4} />
				<Label
					text={t("drill.buffer", { count: formatCount(state.buffer, def.bufferCapacity) })}
					tone={state.buffer > 0 ? "danger" : "muted"}
					order={5}
				/>
				{blocked && <Label text={t("drill.beltFull")} tone="danger" order={6} />}
			</Card>
			<Label text={t("drill.choose")} display={true} order={2} />
			{oresOfLayer(layer).map((oreId, index) => {
				const allowed = canDrillOre(layer, oreId, pickaxe.tier);
				const selected = oreId === state.oreId;
				return (
					<Button
						key={oreId}
						text={
							selected
								? `✅ ${t(nameKeys.ore(oreId))}`
								: `${t(nameKeys.ore(oreId))} (${formatMoney(ORES[oreId].price)})`
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
				title: t("drill.title", { layer: t(nameKeys.layer(layer)) }),
				icon: "⚙️",
				render: () => <DrillPanel layer={layer} />,
			});
		}
	});

	registerHudStat(5, (view) => ({
		icon: "🕳",
		text: t("hud.deepest", {
			layer: t(nameKeys.layer(view.deepestLayer)),
			n: view.deepestLayer,
			total: LAYER_COUNT,
		}),
		short: `${view.deepestLayer}/${LAYER_COUNT}`,
	}));
	// No walk speed tile: it is in the shop and the items panel (HUD clean-up, 2026-11-26).

	registerGoalSource((view) => {
		for (let layer = 1; layer <= LAYER_COUNT; layer++) {
			const def = DRILLS[layer];
			if (
				def !== undefined &&
				isDrillUnlocked(layer, view.deepestLayer) &&
				view.drills[drillKey(layer)] === undefined
			) {
				return [{ label: nameKeys.drill(layer), price: def.price, priority: 1 }];
			}
		}
		return [];
	});
}
