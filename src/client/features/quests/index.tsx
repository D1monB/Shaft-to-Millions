// quests feature (client): the quests panel and its dock button (decision 055).
// Public API of this feature. Other code imports only from this file.
import React from "@rbxts/react";
import { registerHudButton } from "client/features/hud";
import { t } from "client/lib/i18n";
import { openPanel } from "client/lib/panels";
import { QuestsPanel } from "./quests-panel";

export function startQuestsController(): void {
	registerHudButton(
		"📜",
		() => t("menu.quests"),
		() => openPanel({ key: "quests", title: t("quests.title"), icon: "📜", render: () => <QuestsPanel /> }),
		8,
		"primary",
	);
}
