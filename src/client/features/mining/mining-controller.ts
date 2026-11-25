// Mining effects only. The server decides every hit; this file shows what happened and labels each node
// with what the player needs to know: ore name, price, hits needed, or which pickaxe unlocks it.
// World labels stay plain Instances (not React): there can be hundreds of nodes and they rarely change.
import { CollectionService, TweenService } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { ORES, isOreId } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import {
	MINE_PROGRESS_REMOTE,
	NODE_BROKEN_REMOTE,
	canMineTier,
	getPickaxe,
	hitsRequired,
} from "shared/features/mining";
import { PlayerView } from "shared/features/profile";
import { formatMoney } from "shared/lib/format";
import { registerHudStat } from "client/features/hud";
import { getView, onViewChanged } from "client/features/profile";
import { onServerMessage } from "client/lib/remotes";
import { playOreBreak, playSound } from "client/lib/sounds";
import { COLORS, FONTS } from "client/lib/ui-kit";

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

function addOutline(label: TextLabel, thickness: number): void {
	const stroke = new Instance("UIStroke");
	stroke.Color = COLORS.outline;
	stroke.Thickness = thickness;
	stroke.Parent = label;
}

function round(frame: Frame): void {
	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(1, 0);
	corner.Parent = frame;
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
	billboard.Size = new UDim2(0, 170, 0, 46);
	billboard.StudsOffset = new Vector3(0, part.Size.Y / 2 + 1.8, 0);
	billboard.MaxDistance = 40;
	billboard.AlwaysOnTop = true;
	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.Font = FONTS.display;
	label.TextScaled = true;
	addOutline(label, 2);
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
	const pickaxe = getPickaxe(view.gear.equipped.pickaxe);
	if (canMineTier(ore, pickaxe)) {
		const hits = hitsRequired(ore.hardness, pickaxe.power);
		label.Text = `${ore.name} · ${formatMoney(ore.price)}\n${hits} ${hits === 1 ? "удар" : "ударів"}`;
		label.TextColor3 = COLORS.text;
	} else {
		const needed = PICKAXES.find((p) => p.tier >= ore.requiredTier)?.name ?? "краща кирка";
		label.Text = `🔒 ${ore.name} · ${formatMoney(ore.price)}\nПотрібна: ${needed}`;
		label.TextColor3 = COLORS.danger;
	}
}

function refreshAllLabels(view: PlayerView): void {
	for (const node of CollectionService.GetTagged(TAGS.OreNode)) {
		refreshNodeLabel(node, view);
	}
}

// ---------------------------------------------------------------- hit progress and break effects

const HIT_TWEEN = new TweenInfo(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);

const bars = new Map<Instance, { gui: BillboardGui; fill: Frame; hideAt: number }>();

function showProgress(node: Instance, damage: number, hardness: number): void {
	const part = anchorPart(node);
	if (part === undefined) {
		return;
	}
	let bar = bars.get(node);
	if (bar === undefined) {
		const gui = new Instance("BillboardGui");
		gui.Size = new UDim2(0, 120, 0, 14);
		gui.StudsOffset = new Vector3(0, part.Size.Y / 2 + 0.6, 0);
		gui.AlwaysOnTop = true;
		const back = new Instance("Frame");
		back.Size = new UDim2(1, 0, 1, 0);
		back.BackgroundColor3 = COLORS.woodDark;
		back.BorderSizePixel = 0;
		round(back);
		const stroke = new Instance("UIStroke");
		stroke.Color = COLORS.outline;
		stroke.Thickness = 2;
		stroke.Parent = back;
		back.Parent = gui;
		const fill = new Instance("Frame");
		fill.BackgroundColor3 = COLORS.gold;
		fill.BorderSizePixel = 0;
		fill.Size = new UDim2(0, 0, 1, 0);
		round(fill);
		fill.Parent = back;
		gui.Adornee = part;
		gui.Parent = part;
		bar = { gui, fill, hideAt: 0 };
		bars.set(node, bar);
	}
	const progress = hardness > 0 ? math.clamp(damage / hardness, 0, 1) : 0;
	// A short tween makes each hit feel like it bites into the block.
	TweenService.Create(bar.fill, HIT_TWEEN, { Size: new UDim2(progress, 0, 1, 0) }).Play();
	bar.gui.Enabled = true;
	const entry = bar;
	entry.hideAt = os.clock() + 2;
	task.delay(2.05, () => {
		if (os.clock() >= entry.hideAt) {
			entry.gui.Enabled = false;
		}
	});
}

const POPUP_SECONDS = 1.1;
const POPUP_SIZE = new UDim2(0, 170, 0, 40);
const POPUP_SIZE_SMALL = new UDim2(0, 90, 0, 22);
const POPUP_POP = new TweenInfo(0.18, Enum.EasingStyle.Back, Enum.EasingDirection.Out);
const POPUP_RISE = new TweenInfo(POPUP_SECONDS, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
const POPUP_FADE = new TweenInfo(0.4, Enum.EasingStyle.Linear, Enum.EasingDirection.In, 0, false, POPUP_SECONDS - 0.4);

// Floating "+1 Coal" texts are reused instead of created and destroyed for every break (object pool).
const popupPool: Array<{ gui: BillboardGui; label: TextLabel }> = [];

function showPopup(part: BasePart, text: string): void {
	let popup = popupPool.pop();
	if (popup === undefined) {
		const gui = new Instance("BillboardGui");
		gui.AlwaysOnTop = true;
		const label = new Instance("TextLabel");
		label.Size = new UDim2(1, 0, 1, 0);
		label.BackgroundTransparency = 1;
		label.Font = FONTS.display;
		label.TextScaled = true;
		label.TextColor3 = COLORS.gold;
		addOutline(label, 2.5);
		label.Parent = gui;
		popup = { gui, label };
	}
	const start = new Vector3(0, part.Size.Y / 2 + 1, 0);
	popup.label.Text = text;
	popup.label.TextTransparency = 0;
	popup.gui.Size = POPUP_SIZE_SMALL;
	popup.gui.StudsOffset = start;
	popup.gui.Adornee = part;
	popup.gui.Parent = part;
	// Pop bigger, rise and fade out, then return to the pool.
	TweenService.Create(popup.gui, POPUP_POP, { Size: POPUP_SIZE }).Play();
	TweenService.Create(popup.gui, POPUP_RISE, { StudsOffset: start.add(new Vector3(0, 3, 0)) }).Play();
	TweenService.Create(popup.label, POPUP_FADE, { TextTransparency: 1 }).Play();
	const used = popup;
	task.delay(POPUP_SECONDS, () => {
		used.gui.Parent = undefined;
		popupPool.push(used);
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
	// The bag is shown in the HUD top bar; only the pickaxe goes to the stat column.
	registerHudStat(20, (view) => {
		const name = getPickaxe(view.gear.equipped.pickaxe).name;
		// The first word fits on the tile ("Залізна"); the whole name is in the tooltip.
		return { icon: "⛏️", text: `Кирка: ${name}`, short: name.split(" ")[0] ?? name };
	});

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
			playSound("hit");
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
		playOreBreak(oreId);
		bars.get(node)?.gui.Destroy();
		bars.delete(node);
		hideNode(node, respawnSeconds);
	});
}
