// Dev panel button. Shown only in Studio; the server enforces the same rule, so hiding it here is just tidiness.
import { RunService } from "@rbxts/services";
import { DEV_COMMAND_REMOTE, DEV_MONEY_AMOUNTS } from "shared/features/devtools";
import { formatMoney } from "shared/lib/format";
import { registerHudButton } from "client/features/hud";
import { sendToServer } from "client/lib/remotes";
import { THEME, makeButton, makeLabel, openPanel } from "client/lib/ui";

function render(content: ScrollingFrame): void {
	makeLabel(content, "Лише для тестів у Studio. На живих серверах цього немає.", { color: THEME.muted });
	for (const amount of DEV_MONEY_AMOUNTS) {
		makeButton(content, `+${formatMoney(amount)}`, () => sendToServer(DEV_COMMAND_REMOTE, "money", amount));
	}
	makeButton(content, "Максимальне спорядження", () => sendToServer(DEV_COMMAND_REMOTE, "maxGear"));
	makeButton(content, "Відкрити всі шари", () => sendToServer(DEV_COMMAND_REMOTE, "openLayers"));
}

export function startDevtoolsController(): void {
	if (!RunService.IsStudio()) {
		return;
	}
	registerHudButton("🛠 Dev", () => openPanel("devtools", "Dev-інструменти", render));
}
