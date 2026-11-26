// store feature (client): the store panel and its dock button, plus a stat tile while a booster runs (decision 057).
// Public API of this feature. Other code imports only from this file.
import React from "@rbxts/react";
import { activeBoosters, boostSecondsLeft } from "shared/features/boosters";
import { StringKey } from "shared/config/i18n";
import { formatDuration } from "shared/lib/format";
import { registerHudButton, registerHudStat } from "client/features/hud";
import { t } from "client/lib/i18n";
import { openPanel } from "client/lib/panels";
import { StorePanel } from "./store-panel";

export function startStoreController(): void {
	registerHudButton(
		"💎",
		() => t("menu.store"),
		() => openPanel({ key: "store", title: t("store.title"), icon: "💎", render: () => <StorePanel /> }),
		6,
		"success",
	);
	registerHudStat(5, (view) => {
		const now = os.time();
		const active = activeBoosters(view.boosts, now);
		if (active.size() === 0) {
			return undefined;
		}
		const lines = active.map(
			(id) => `${t(`booster.${id}` as StringKey)}: ${formatDuration(boostSecondsLeft(view.boosts, id, now))}`,
		);
		return { icon: "⚡", text: lines.join("\n"), short: `x${active.size()}`, tone: "gold" };
	});
}
