// admin feature (client): the "Dev" button (only for the owner and developers) and its panel (decision 068).
// Public API of this feature. Other code imports only from this file.
import React from "@rbxts/react";
import { Players } from "@rbxts/services";
import { ADMIN_ROLE_ATTRIBUTE } from "shared/features/admin";
import { refreshHud, registerHudButton } from "client/features/hud";
import { openPanel } from "client/lib/panels";
import { AdminPanel } from "./admin-panel";
import { ownRole } from "./role";

export function startAdminController(): void {
	registerHudButton(
		"👑",
		"Dev",
		() => openPanel({ key: "admin", title: "Dev", icon: "👑", render: () => <AdminPanel /> }),
		80,
		"primary",
		false,
		() => ownRole() !== undefined,
	);
	Players.LocalPlayer.GetAttributeChangedSignal(ADMIN_ROLE_ATTRIBUTE).Connect(refreshHud);
}
