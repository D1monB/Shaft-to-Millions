// Titles above players' heads (decision 070), drawn by each client from the server-set Title attribute, in the
// viewer's own language.
import { Players } from "@rbxts/services";
import { StringKey } from "shared/config/i18n";
import { TITLE_ATTRIBUTE, findAchievement } from "shared/features/progress";
import { onLanguageChanged, t } from "client/lib/i18n";
import { FONTS } from "client/lib/ui-kit";

const NAME = "TitleTag";

function draw(player: Player): void {
	const head = player.Character?.FindFirstChild("Head");
	if (head === undefined || !head.IsA("BasePart")) {
		return;
	}
	head.FindFirstChild(NAME)?.Destroy();
	const def = findAchievement(player.GetAttribute(TITLE_ATTRIBUTE));
	if (def === undefined) {
		return;
	}
	const gui = new Instance("BillboardGui");
	gui.Name = NAME;
	gui.Size = UDim2.fromOffset(160, 24);
	gui.StudsOffsetWorldSpace = new Vector3(0, 3, 0);
	gui.MaxDistance = 60;
	const label = new Instance("TextLabel");
	label.BackgroundTransparency = 1;
	label.Size = UDim2.fromScale(1, 1);
	label.Font = FONTS.display;
	label.TextScaled = true;
	label.TextColor3 = Color3.fromRGB(def.color[0], def.color[1], def.color[2]);
	label.TextStrokeTransparency = 0.1;
	label.Text = `« ${t(`title.${def.id}` as StringKey)} »`;
	label.Parent = gui;
	gui.Parent = head;
}

function watch(player: Player): void {
	player.CharacterAdded.Connect((character) => {
		task.spawn(() => {
			character.WaitForChild("Head", 10);
			draw(player);
		});
	});
	player.GetAttributeChangedSignal(TITLE_ATTRIBUTE).Connect(() => draw(player));
	draw(player);
}

export function startOverheadTitles(): void {
	Players.PlayerAdded.Connect(watch);
	Players.GetPlayers().forEach(watch);
	onLanguageChanged(() => Players.GetPlayers().forEach(draw));
}
