// health feature (client): our own health bar tile in the HUD instead of Roblox's small default one (decision 067).
import { Players, StarterGui } from "@rbxts/services";
import { refreshHud, registerHudStat } from "client/features/hud";
import { t } from "client/lib/i18n";

let health = 100;
let maxHealth = 100;

function watch(character: Model): void {
	task.spawn(() => {
		const humanoid = character.WaitForChild("Humanoid", 10);
		if (humanoid === undefined || !humanoid.IsA("Humanoid")) {
			return;
		}
		const read = () => {
			health = math.max(0, math.ceil(humanoid.Health));
			maxHealth = humanoid.MaxHealth;
			refreshHud();
		};
		humanoid.HealthChanged.Connect(read);
		read();
	});
}

export function startHealthController(): void {
	registerHudStat(1, () => ({
		icon: "❤",
		text: t("health.tile", { health, max: math.ceil(maxHealth) }),
		short: `${health}`,
		tone: health < maxHealth * 0.35 ? "danger" : "success",
	}));
	const player = Players.LocalPlayer;
	player.CharacterAdded.Connect(watch);
	if (player.Character !== undefined) {
		watch(player.Character);
	}
	pcall(() => StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Health, false));
}
