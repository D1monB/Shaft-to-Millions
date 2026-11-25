// The map author's chest terminals (pets, pickaxe aura, character aura) on every plot become chest stands.
// At server start each terminal gets an invisible anchor at its PromptPoint, tagged Chest with the right ChestId, so
// the usual chest flow works: the prompt opens the odds panel, and the server checks the player stands near a
// tagged anchor with that ChestId before charging. The place file is never changed (runtime only).
import { CollectionService, Workspace } from "@rbxts/services";
import { CHESTS, ChestId, isChestId } from "shared/config/chests";
import { CHEST_DISTANCE } from "shared/features/chests";
import { ATTRIBUTES, CHEST_TERMINALS, PLOTS, TAGS } from "shared/config/map-contract";

const ANCHOR_NAME = "ChestStand";

/** Height of the prompt above the terminal's floor: about a character's chest. */
const PROMPT_HEIGHT = 3;

/**
 * Where the prompt goes: above PromptPoint (else RollButton, else the middle of the model), but at chest height.
 * Why not at the attachment itself: it sits high on the terminal, and a player standing close looks under it, so
 * the prompt was off screen and Roblox hid it.
 */
function promptPosition(terminal: Model): Vector3 {
	const point =
		terminal.FindFirstChild(CHEST_TERMINALS.PromptPoint, true) ??
		terminal.FindFirstChild(CHEST_TERMINALS.FallbackPoint, true);
	const at = point !== undefined && point.IsA("Attachment") ? point.WorldPosition : terminal.GetPivot().Position;
	const [box, size] = terminal.GetBoundingBox();
	return new Vector3(at.X, box.Position.Y - size.Y / 2 + PROMPT_HEIGHT, at.Z);
}

function makeStand(terminal: Model, chestId: ChestId): void {
	if (terminal.FindFirstChild(ANCHOR_NAME) !== undefined) {
		return;
	}
	const anchor = new Instance("Part");
	anchor.Name = ANCHOR_NAME;
	anchor.Anchored = true;
	anchor.CanCollide = false;
	anchor.CanTouch = false;
	anchor.CanQuery = false;
	anchor.Transparency = 1;
	anchor.Size = new Vector3(2, 2, 2);
	anchor.Position = promptPosition(terminal);
	// The service adds the usual chest prompt when the tag appears; on a terminal it must always show. With the
	// default OnePerButton, another E prompt nearby (belt intake, plot claim) took the focus and the chest prompt
	// never appeared. Made here, before the tag, so the service sees a prompt already exists and keeps this one.
	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = "Подивитись";
	prompt.ObjectText = CHESTS[chestId].name;
	prompt.Exclusivity = Enum.ProximityPromptExclusivity.AlwaysShow;
	prompt.RequiresLineOfSight = false;
	prompt.HoldDuration = 0;
	prompt.MaxActivationDistance = CHEST_DISTANCE - 2;
	prompt.Parent = anchor;
	anchor.SetAttribute(ATTRIBUTES.ChestId, chestId);
	anchor.Parent = terminal;
	// Tag last: the chest flow finds stands by this tag and reads the ChestId set above.
	CollectionService.AddTag(anchor, TAGS.Chest);
}

/** Turns every known terminal on every plot into a chest stand. Returns how many were found. */
export function setupChestTerminals(): number {
	const plots = Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(PLOTS.PlotsFolder);
	let count = 0;
	for (const plot of plots?.GetChildren() ?? []) {
		const terminals = plot.FindFirstChild(CHEST_TERMINALS.Folder);
		for (const [name, chestId] of pairs(CHEST_TERMINALS.Chests)) {
			const terminal = terminals?.FindFirstChild(name);
			if (terminal !== undefined && terminal.IsA("Model") && isChestId(chestId)) {
				makeStand(terminal, chestId);
				count += 1;
			}
		}
	}
	return count;
}
