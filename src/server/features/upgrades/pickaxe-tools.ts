// The pickaxe the player holds (decision 037): a copy of the map author's Tool for the EQUIPPED pickaxe, and only that
// one. Which pickaxes a player owns is profile data; the Tool is just its look in the hand. Hits still go through the
// mining feature, which reads the equipped pickaxe from the profile, never from the Tool.
import { Players, ReplicatedStorage, ServerStorage, StarterPack } from "@rbxts/services";
import { PICKAXES } from "shared/config/pickaxes";
import { PICKAXE_ID_ATTRIBUTE, PICKAXE_TEMPLATES_FOLDER } from "shared/features/upgrades";
import { getProfileData, onProfileLoaded } from "server/features/profile";

const toolNames = new Set(PICKAXES.map((def) => def.tool));
let warnedMissing = false;

function templates(): Instance | undefined {
	return ServerStorage.FindFirstChild(PICKAXE_TEMPLATES_FOLDER);
}

/** Our pickaxe tools in a container, plus stray copies of the map author's tools (from an old StarterPack). */
function pickaxeTools(container: Instance | undefined): Tool[] {
	return (container?.GetChildren() ?? []).filter(
		(child): child is Tool =>
			child.IsA("Tool") && (child.GetAttribute(PICKAXE_ID_ATTRIBUTE) !== undefined || toolNames.has(child.Name)),
	);
}

/** Gives the player the Tool of their equipped pickaxe, replacing any other one. Safe to call any time. */
export function syncPickaxeTool(player: Player): void {
	const data = getProfileData(player);
	const backpack = player.FindFirstChildOfClass("Backpack");
	const character = player.Character;
	const humanoid = character?.FindFirstChildOfClass("Humanoid");
	if (data === undefined || backpack === undefined || humanoid === undefined || humanoid.Health <= 0) {
		return;
	}
	const def = PICKAXES.find((candidate) => candidate.id === data.gear.equipped.pickaxe) ?? PICKAXES[0];
	const tools = [...pickaxeTools(backpack), ...pickaxeTools(character)];
	const current = tools.find((tool) => tool.GetAttribute(PICKAXE_ID_ATTRIBUTE) === def.id);
	for (const tool of tools) {
		if (tool !== current) {
			tool.Destroy();
		}
	}
	if (current !== undefined) {
		return;
	}
	const template = templates()?.FindFirstChild(def.tool);
	if (template === undefined || !template.IsA("Tool")) {
		if (!warnedMissing) {
			warnedMissing = true;
			warn(`[upgrades] ServerStorage.${PICKAXE_TEMPLATES_FOLDER}.${def.tool} not found: no pickaxe in hand`);
		}
		return;
	}
	const tool = template.Clone();
	tool.SetAttribute(PICKAXE_ID_ATTRIBUTE, def.id);
	tool.CanBeDropped = false;
	tool.Parent = backpack;
	// A new character, a purchase or a pick from the hotbar: the pickaxe goes straight into the hand.
	humanoid.EquipTool(tool);
}

/**
 * The map author put all pickaxes into StarterPack for testing, which would hand every pickaxe to everyone for free.
 * They are taken out at server start (the place file is not changed). Copies go to ReplicatedStorage so the hotbar can
 * draw them; any script inside stays on the server.
 */
function prepareTemplates(): void {
	for (const child of StarterPack.GetChildren()) {
		if (child.IsA("Tool") && toolNames.has(child.Name)) {
			child.Destroy();
		}
	}
	const source = templates();
	if (source === undefined || ReplicatedStorage.FindFirstChild(PICKAXE_TEMPLATES_FOLDER) !== undefined) {
		return;
	}
	const copy = source.Clone();
	for (const descendant of copy.GetDescendants()) {
		if (descendant.IsA("LuaSourceContainer")) {
			descendant.Destroy();
		}
	}
	copy.Parent = ReplicatedStorage;
}

export function startPickaxeTools(): void {
	prepareTemplates();
	const watch = (player: Player) => {
		// The character's own copies from StarterPack arrive a moment after spawning, so the sync waits a frame.
		player.CharacterAdded.Connect(() => task.defer(() => syncPickaxeTool(player)));
	};
	Players.PlayerAdded.Connect(watch);
	Players.GetPlayers().forEach(watch);
	onProfileLoaded((player) => syncPickaxeTool(player));
}
