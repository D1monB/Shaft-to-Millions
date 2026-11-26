// base feature (client): the base upgrades panel in the More menu.
// Public API of this feature. Other code imports only from this file.
import React from "@rbxts/react";
import { isMenuUnlocked, registerHudButton } from "client/features/hud";
import { t } from "client/lib/i18n";
import { openPanel } from "client/lib/panels";
import { BasePanel } from "./base-panel";

export function startBaseController(): void {
	const open = () => openPanel({ key: "base", title: t("base.title"), icon: "🏗", render: () => <BasePanel /> });
	// In the More menu (decision 067): the base lives only in menus, nothing is built on the plot.
	registerHudButton(
		"🏗",
		() => t("menu.build"),
		open,
		7,
		"primary",
		true,
		() => isMenuUnlocked("base"),
	);
}
