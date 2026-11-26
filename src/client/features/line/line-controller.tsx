// Starts the line on the client: belt items, progress bars, the upgrade panel and the "next machine" goal.
import React from "@rbxts/react";
import { LINE_MACHINES } from "shared/config/line";
import { PLOT_ATTRIBUTES } from "shared/config/map-contract";
import { nameKeys, text } from "shared/features/i18n";
import { BELT_POINT_TAG, UPGRADE_POINT_TAG, nextLineMachine } from "shared/features/line";
import { registerGoalSource } from "client/features/goals";
import { t, tx } from "client/lib/i18n";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { toast } from "client/lib/toasts";
import { startBeltVisuals } from "./belt-visuals";
import { startMachineHum } from "./machine-hum";
import { startMachineGauges } from "./machine-gauges";
import { isOnOwnPlot } from "./own-plot";
import { BeltPanel, UpgradePanel } from "./upgrade-panel";

function openUpgrades(anchor: Instance): void {
	const stage = anchor.GetAttribute(PLOT_ATTRIBUTES.Stage);
	if (!typeIs(stage, "number")) {
		return;
	}
	if (!isOnOwnPlot(anchor)) {
		toast(tx(text("line.notYours")), "error");
		return;
	}
	const def = LINE_MACHINES[stage - 1];
	if (def !== undefined) {
		openPanel({
			key: `line_machine_${stage}`,
			title: t(nameKeys.machine(def.id)),
			icon: "⚙️",
			render: () => <UpgradePanel index={stage - 1} />,
		});
	}
}

export function startLineController(): void {
	startBeltVisuals();
	startMachineHum();
	startMachineGauges();
	onPromptForTag(UPGRADE_POINT_TAG, openUpgrades);
	onPromptForTag(BELT_POINT_TAG, (part) => {
		if (!isOnOwnPlot(part)) {
			toast(tx(text("line.notYours")), "error");
			return;
		}
		openPanel({ key: "belt", title: t("line.track.belt"), icon: "🛤", render: () => <BeltPanel /> });
	});
	registerGoalSource((view) => {
		const nextMachine = nextLineMachine(view.line);
		return nextMachine !== undefined
			? [{ label: nameKeys.machine(nextMachine.id), price: nextMachine.price, priority: 1 }]
			: [];
	});
}
