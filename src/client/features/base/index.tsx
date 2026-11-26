// base feature (client): the base panel, its dock button, the building prompts and a "builder free" tile.
// Public API of this feature. Other code imports only from this file.
import React from "@rbxts/react";
import { BASE_SITE_TAG } from "shared/features/base";
import { registerHudButton } from "client/features/hud";
import { t } from "client/lib/i18n";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { BasePanel } from "./base-panel";

export function startBaseController(): void {
	const open = () => openPanel({ key: "base", title: t("base.title"), icon: "🏗", render: () => <BasePanel /> });
	onPromptForTag(BASE_SITE_TAG, open);
	registerHudButton("🏗", () => t("menu.build"), open, 7, "primary");
}
