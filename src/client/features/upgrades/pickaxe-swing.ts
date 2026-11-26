// Swinging the pickaxe Tool (decision 037). Roblox switches ClickDetectors off while a Tool is held, so a swing names
// the ore node under the cursor (or the tap) to the server, which decides everything. The slash itself is Roblox's
// default tool animation (a "toolanim" value), so no animation asset is needed.
import { CollectionService, Debris, Players } from "@rbxts/services";
import { TAGS } from "shared/config/map-contract";
import { MAX_MINING_DISTANCE, MINE_HIT_REMOTE, getPickaxe } from "shared/features/mining";
import { PICKAXE_ID_ATTRIBUTE } from "shared/features/upgrades";
import { getView } from "client/features/profile";
import { sendToServer } from "client/lib/remotes";
import { playSound } from "client/lib/sounds";

const player = Players.LocalPlayer;
let lastSwing = 0;

function oreNodeOf(part: Instance | undefined): Instance | undefined {
	let node = part;
	while (node !== undefined && node !== game.Workspace) {
		if (CollectionService.HasTag(node, TAGS.OreNode)) {
			return node;
		}
		node = node.Parent;
	}
	return undefined;
}

function playSlash(tool: Tool): void {
	const anim = new Instance("StringValue");
	anim.Name = "toolanim";
	anim.Value = "Slash";
	anim.Parent = tool;
	Debris.AddItem(anim, 1);
}

function swing(tool: Tool): void {
	const view = getView();
	const pickaxe = getPickaxe(view?.gear.equipped.pickaxe ?? "");
	const now = os.clock();
	// The server enforces the real cooldown; this only keeps the animation and the remote in step with it.
	if (now - lastSwing < pickaxe.swingSeconds) {
		return;
	}
	lastSwing = now;
	playSlash(tool);
	const mouse = player.GetMouse();
	const node = oreNodeOf(mouse.Target);
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	if (node === undefined || root === undefined || !root.IsA("BasePart")) {
		return;
	}
	// Far nodes are not even sent. Measured like the server does it (to the node itself, not to the clicked spot),
	// so an honest swing is never refused as too far.
	const target = node.IsA("PVInstance") ? node.GetPivot().Position : undefined;
	if (target !== undefined && target.sub(root.Position).Magnitude <= MAX_MINING_DISTANCE) {
		// Played at once (feedback 2026-11-26: the sound lagged behind the swing when it waited for the server).
		playSound("hit");
		sendToServer(MINE_HIT_REMOTE, node);
	}
}

/** Tools already connected: a tool enters the character again each time it is taken out of the backpack. */
const connected = new Set<Tool>();

function watchCharacter(character: Model): void {
	character.ChildAdded.Connect((child) => {
		if (!child.IsA("Tool") || child.GetAttribute(PICKAXE_ID_ATTRIBUTE) === undefined || connected.has(child)) {
			return;
		}
		connected.add(child);
		child.Activated.Connect(() => swing(child));
		child.Destroying.Connect(() => connected.delete(child));
	});
}

export function startPickaxeSwing(): void {
	if (player.Character !== undefined) {
		watchCharacter(player.Character);
	}
	player.CharacterAdded.Connect(watchCharacter);
}
