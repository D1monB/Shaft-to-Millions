// Mining effects only. The server decides every hit; this file shows what happened and labels each node
// with what the player needs to know: ore name, price, hits needed, or which pickaxe unlocks it.
import { CollectionService } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { ORES, isOreId } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { bagCapacity, bagTotal } from "shared/features/bag";
import {
	MINE_PROGRESS_REMOTE,
	NODE_BROKEN_REMOTE,
	canMineTier,
	getPickaxe,
	hitsRequired,
} from "shared/features/mining";
import { PlayerView } from "shared/features/profile";
import { formatMoney } from "shared/lib/format";
import { getView, onViewChanged } from "client/features/profile";
import { registerHudLine } from "client/features/hud";
import { onServerMessage } from "client/lib/remotes";
import { THEME } from "client/lib/ui";

function anchorPart(node: Instance): BasePart | undefined {
	if (node.IsA("BasePart")) {
		return node;
	}
	if (node.IsA("Model")) {
		return node.PrimaryPart ?? node.FindFirstChildWhichIsA("BasePart", true);
	}
	return undefined;
}

function partsOf(node: Instance): BasePart[] {
	const parts: BasePart[] = [];
	if (node.IsA("BasePart")) {
		parts.push(node);
	}
	for (const child of node.GetDescendants()) {
		if (child.IsA("BasePart")) {
			parts.push(child);
		}
	}
	return parts;
}

// ---------------------------------------------------------------- node labels

const labels = new Map<Instance, TextLabel>();

function getNodeLabel(node: Instance): TextLabel | undefined {
	const existing = labels.get(node);
	if (existing !== undefined) {
		return existing;
	}
	const part = anchorPart(node);
	if (part === undefined) {
		return undefined;
	}
	const billboard = new Instance("BillboardGui");
	billboard.Name = "OreLabel";
	billboard.Size = new UDim2(0, 160, 0, 44);
	billboard.StudsOffset = new Vector3(0, part.Size.Y / 2 + 1.8, 0);
	billboard.MaxDistance = 40;
	billboard.AlwaysOnTop = true;
	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.Font = Enum.Font.GothamBold;
	label.TextScaled = true;
	label.TextStrokeTransparency = 0.4;
	label.Parent = billboard;
	billboard.Adornee = part;
	billboard.Parent = part;
	labels.set(node, label);
	return label;
}

function refreshNodeLabel(node: Instance, view: PlayerView): void {
	const oreId = node.GetAttribute(ATTRIBUTES.OreId);
	if (!isOreId(oreId)) {
		return;
	}
	const label = getNodeLabel(node);
	if (label === undefined) {
		return;
	}
	const ore = ORES[oreId];
	const pickaxe = getPickaxe(view.levels.pickaxe);
	if (canMineTier(ore, pickaxe)) {
		const hits = hitsRequired(ore.hardness, pickaxe.power);
		label.Text = `${ore.name} · ${formatMoney(ore.price)}\n${hits} ${hits === 1 ? "удар" : "ударів"}`;
		label.TextColor3 = THEME.text;
	} else {
		const needed = PICKAXES.find((p) => p.tier >= ore.requiredTier)?.name ?? "краща кирка";
		label.Text = `🔒 ${ore.name} · ${formatMoney(ore.price)}\nПотрібна: ${needed}`;
		label.TextColor3 = THEME.danger;
	}
}

function refreshAllLabels(view: PlayerView): void {
	for (const node of CollectionService.GetTagged(TAGS.OreNode)) {
		refreshNodeLabel(node, view);
	}
}

// ---------------------------------------------------------------- hit progress and break effects

const bars = new Map<Instance, { gui: BillboardGui; fill: Frame; hideAt: number }>();

function showProgress(node: Instance, damage: number, hardness: number): void {
	const part = anchorPart(node);
	if (part === undefined) {
		return;
	}
	let bar = bars.get(node);
	if (bar === undefined) {
		const gui = new Instance("BillboardGui");
		gui.Size = new UDim2(0, 120, 0, 12);
		gui.StudsOffset = new Vector3(0, part.Size.Y / 2 + 0.6, 0);
		gui.AlwaysOnTop = true;
		const back = new Instance("Frame");
		back.Size = new UDim2(1, 0, 1, 0);
		back.BackgroundColor3 = THEME.background;
		back.Parent = gui;
		const fill = new Instance("Frame");
		fill.BackgroundColor3 = THEME.accent;
		fill.BorderSizePixel = 0;
		fill.Parent = back;
		gui.Adornee = part;
		gui.Parent = part;
		bar = { gui, fill, hideAt: 0 };
		bars.set(node, bar);
	}
	const progress = hardness > 0 ? math.clamp(damage / hardness, 0, 1) : 0;
	bar.fill.Size = new UDim2(progress, 0, 1, 0);
	bar.gui.Enabled = true;
	const entry = bar;
	entry.hideAt = os.clock() + 2;
	task.delay(2.05, () => {
		if (os.clock() >= entry.hideAt) {
			entry.gui.Enabled = false;
		}
	});
}

// Floating "+1 Coal" texts are reused instead of created and destroyed for every break (object pool).
const popupPool: BillboardGui[] = [];

function showPopup(part: BasePart, text: string): void {
	let gui = popupPool.pop();
	if (gui === undefined) {
		gui = new Instance("BillboardGui");
		gui.Size = new UDim2(0, 160, 0, 36);
		gui.AlwaysOnTop = true;
		const label = new Instance("TextLabel");
		label.Name = "Text";
		label.Size = new UDim2(1, 0, 1, 0);
		label.BackgroundTransparency = 1;
		label.Font = Enum.Font.GothamBlack;
		label.TextScaled = true;
		label.TextColor3 = THEME.success;
		label.TextStrokeTransparency = 0.2;
		label.Parent = gui;
	}
	const label = gui.FindFirstChild("Text") as TextLabel;
	label.Text = text;
	gui.Adornee = part;
	gui.StudsOffset = new Vector3(0, part.Size.Y / 2 + 1, 0);
	gui.Parent = part;
	const popup = gui;
	// Rise for one second, then return to the pool.
	for (let step = 1; step <= 10; step++) {
		task.delay(step * 0.08, () => (popup.StudsOffset = popup.StudsOffset.add(new Vector3(0, 0.25, 0))));
	}
	task.delay(1, () => {
		popup.Parent = undefined;
		popupPool.push(popup);
	});
}

function hideNode(node: Instance, seconds: number): void {
	// Local only: the node is depleted for THIS player; others still see and mine it.
	const parts = partsOf(node);
	for (const part of parts) {
		part.LocalTransparencyModifier = 0.85;
		part.CanCollide = false;
	}
	const label = labels.get(node);
	if (label !== undefined) {
		label.Visible = false;
	}
	task.delay(seconds, () => {
		for (const part of parts) {
			part.LocalTransparencyModifier = 0;
			part.CanCollide = true;
		}
		if (label !== undefined) {
			label.Visible = true;
		}
	});
}

export function startMiningController(): void {
	registerHudLine(10, (view) => {
		const capacity = bagCapacity(view.levels.bag);
		const total = bagTotal(view.bag);
		return `🎒 ${total}/${capacity}${total >= capacity ? "  (повна!)" : ""}`;
	});
	registerHudLine(20, (view) => `⛏ ${getPickaxe(view.levels.pickaxe).name}`);

	onViewChanged(refreshAllLabels);
	CollectionService.GetInstanceAddedSignal(TAGS.OreNode).Connect((node) => {
		const view = getView();
		if (view !== undefined) {
			refreshNodeLabel(node, view);
		}
	});
	CollectionService.GetInstanceRemovedSignal(TAGS.OreNode).Connect((node) => {
		labels.delete(node);
		bars.delete(node);
	});

	onServerMessage(MINE_PROGRESS_REMOTE, (node, damage, hardness) => {
		if (typeIs(node, "Instance") && typeIs(damage, "number") && typeIs(hardness, "number")) {
			showProgress(node, damage, hardness);
		}
	});
	onServerMessage(NODE_BROKEN_REMOTE, (node, respawnSeconds, oreId, amount) => {
		if (!typeIs(node, "Instance") || !typeIs(respawnSeconds, "number") || !isOreId(oreId)) {
			return;
		}
		const part = anchorPart(node);
		if (part !== undefined && typeIs(amount, "number") && amount > 0) {
			showPopup(part, `+${amount} ${ORES[oreId].name}`);
		}
		bars.get(node)?.gui.Destroy();
		bars.delete(node);
		hideNode(node, respawnSeconds);
	});
}
