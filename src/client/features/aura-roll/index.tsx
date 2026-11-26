// aura-roll feature (client): the spin panel, its dock button and a tile when free spins wait (decision 064).
// Public API of this feature. Other code imports only from this file.
import React from "@rbxts/react";
import { isItemId } from "shared/config/items";
import { SPIN_RESULT_REMOTE } from "shared/features/aura-roll";
import { registerHudButton, registerHudStat } from "client/features/hud";
import { t } from "client/lib/i18n";
import { openPanel } from "client/lib/panels";
import { onServerMessage } from "client/lib/remotes";
import { AuraPanel } from "./aura-panel";
import { publishResult } from "./reel-state";

export function startAuraRollController(): void {
	registerHudButton(
		"✨",
		() => t("menu.aura"),
		() => openPanel({ key: "aura", title: t("aura.title"), icon: "✨", render: () => <AuraPanel /> }),
		9,
		"success",
	);
	registerHudStat(6, (view) =>
		view.auraRoll.spins > 0
			? {
					icon: "✨",
					text: t("aura.tile", { count: view.auraRoll.spins }),
					short: `${view.auraRoll.spins}`,
					tone: "gold",
				}
			: undefined,
	);
	onServerMessage(SPIN_RESULT_REMOTE, (item) => {
		if (isItemId(item)) {
			publishResult(item);
		}
	});
}
