// The sound switch in the "More" menu (decision 053). Every sound in the game (ours, the map's, the character's
// footsteps) is put into one local SoundGroup, so muting is one volume change and nothing is destroyed.
// The choice is saved on the server and comes back with the profile on the next visit.
import { Players, SoundService } from "@rbxts/services";
import { SET_SOUND_REMOTE } from "shared/features/settings";
import { registerHudButton } from "client/features/hud";
import { onViewChanged } from "client/features/profile";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";

const group = new Instance("SoundGroup");
group.Name = "GameSounds";
group.Parent = SoundService;

let soundOn = true;
let synced = false;

function adopt(instance: Instance): void {
	// A sound the map author put in a group of their own keeps it; only loose sounds join ours.
	if (instance.IsA("Sound") && instance.SoundGroup === undefined) {
		instance.SoundGroup = group;
	}
}

function watch(root: Instance): void {
	for (const descendant of root.GetDescendants()) {
		adopt(descendant);
	}
	root.DescendantAdded.Connect(adopt);
}

function apply(on: boolean): void {
	soundOn = on;
	group.Volume = on ? 1 : 0;
}

function toggle(): void {
	apply(!soundOn);
	sendToServer(SET_SOUND_REMOTE, soundOn);
}

export function startSoundController(): void {
	watch(game.Workspace);
	watch(SoundService);
	const playerGui = Players.LocalPlayer.FindFirstChildOfClass("PlayerGui");
	if (playerGui !== undefined) {
		watch(playerGui);
	}
	// The saved choice arrives with the first profile view; later views must not undo a click made since.
	onViewChanged((view) => {
		if (!synced) {
			synced = true;
			apply(view.soundOn !== false);
		}
	});
	registerHudButton(
		"🔊",
		() => (soundOn ? t("settings.soundOn") : t("settings.soundOff")),
		toggle,
		85,
		"secondary",
		true,
	);
}
