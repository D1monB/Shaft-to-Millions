// Minimal UI toolkit built from plain Instances: HUD lines, one modal panel at a time, and toasts.
// Panels are re-rendered from scratch when the player's data changes, so they always show server truth.
import { Players } from "@rbxts/services";
import { NotifyKind } from "shared/lib/remote-names";

export const THEME = {
	background: Color3.fromRGB(24, 26, 32),
	surface: Color3.fromRGB(38, 41, 50),
	accent: Color3.fromRGB(240, 180, 60),
	text: Color3.fromRGB(235, 235, 240),
	muted: Color3.fromRGB(150, 155, 170),
	success: Color3.fromRGB(90, 200, 120),
	danger: Color3.fromRGB(220, 90, 90),
	disabled: Color3.fromRGB(70, 72, 80),
};

let gui: ScreenGui | undefined;

export function getGui(): ScreenGui {
	if (gui === undefined) {
		const created = new Instance("ScreenGui");
		created.Name = "GameUI";
		created.ResetOnSpawn = false;
		created.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		created.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");
		gui = created;
	}
	return gui;
}

function round(instance: GuiObject, radius = 8): void {
	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, radius);
	corner.Parent = instance;
}

function pad(instance: GuiObject, pixels: number): void {
	const padding = new Instance("UIPadding");
	padding.PaddingTop = new UDim(0, pixels);
	padding.PaddingBottom = new UDim(0, pixels);
	padding.PaddingLeft = new UDim(0, pixels);
	padding.PaddingRight = new UDim(0, pixels);
	padding.Parent = instance;
}

function list(instance: GuiObject, direction: Enum.FillDirection, spacing: number): void {
	const layout = new Instance("UIListLayout");
	layout.FillDirection = direction;
	layout.Padding = new UDim(0, spacing);
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.VerticalAlignment = Enum.VerticalAlignment.Center;
	layout.Parent = instance;
}

let nextOrder = 0;
function order(): number {
	nextOrder += 1;
	return nextOrder;
}

export interface LabelOptions {
	readonly size?: number;
	readonly color?: Color3;
	readonly bold?: boolean;
}

export function makeLabel(parent: Instance, text: string, options: LabelOptions = {}): TextLabel {
	const label = new Instance("TextLabel");
	label.BackgroundTransparency = 1;
	label.Size = new UDim2(1, 0, 0, 0);
	label.AutomaticSize = Enum.AutomaticSize.Y;
	label.TextWrapped = true;
	label.RichText = false;
	label.TextXAlignment = Enum.TextXAlignment.Left;
	label.Font = options.bold === true ? Enum.Font.GothamBold : Enum.Font.Gotham;
	label.TextSize = options.size ?? 16;
	label.TextColor3 = options.color ?? THEME.text;
	label.Text = text;
	label.LayoutOrder = order();
	label.Parent = parent;
	return label;
}

export function makeButton(parent: Instance, text: string, onClick: () => void, enabled = true): TextButton {
	const button = new Instance("TextButton");
	button.Size = new UDim2(1, 0, 0, 36);
	button.AutoButtonColor = enabled;
	button.BackgroundColor3 = enabled ? THEME.accent : THEME.disabled;
	button.TextColor3 = enabled ? THEME.background : THEME.muted;
	button.Font = Enum.Font.GothamBold;
	button.TextSize = 16;
	button.TextWrapped = true;
	button.Text = text;
	button.LayoutOrder = order();
	round(button, 6);
	if (enabled) {
		button.Activated.Connect(onClick);
	}
	button.Parent = parent;
	return button;
}

/** A card: a tinted block that groups related lines inside a panel. */
export function makeCard(parent: Instance): Frame {
	const card = new Instance("Frame");
	card.BackgroundColor3 = THEME.surface;
	card.Size = new UDim2(1, 0, 0, 0);
	card.AutomaticSize = Enum.AutomaticSize.Y;
	card.LayoutOrder = order();
	round(card);
	pad(card, 10);
	list(card, Enum.FillDirection.Vertical, 6);
	card.Parent = parent;
	return card;
}

/** A progress bar from 0 to 1. Values outside the range (or NaN) are clamped. */
export function makeProgressBar(parent: Instance, progress: number, color = THEME.success): Frame {
	const safe = progress === progress ? math.clamp(progress, 0, 1) : 0;
	const back = new Instance("Frame");
	back.BackgroundColor3 = THEME.background;
	back.Size = new UDim2(1, 0, 0, 10);
	back.LayoutOrder = order();
	round(back, 5);
	const fill = new Instance("Frame");
	fill.BackgroundColor3 = color;
	fill.Size = new UDim2(safe, 0, 1, 0);
	round(fill, 5);
	fill.Parent = back;
	back.Parent = parent;
	return back;
}

// ---------------------------------------------------------------- panel (one at a time)

interface OpenPanel {
	readonly id: string;
	readonly frame: Frame;
	readonly content: ScrollingFrame;
	readonly render: (content: ScrollingFrame) => void;
}

let current: OpenPanel | undefined;

export function closePanel(): void {
	current?.frame.Destroy();
	current = undefined;
}

export function isPanelOpen(id: string): boolean {
	return current?.id === id;
}

/** Re-runs the open panel's render function. Called whenever the player's data changes. */
export function refreshPanel(): void {
	if (current === undefined) {
		return;
	}
	const scroll = current.content.CanvasPosition;
	for (const child of current.content.GetChildren()) {
		if (!child.IsA("UIListLayout") && !child.IsA("UIPadding")) {
			child.Destroy();
		}
	}
	current.render(current.content);
	current.content.CanvasPosition = scroll;
}

export function openPanel(id: string, title: string, render: (content: ScrollingFrame) => void): void {
	closePanel();
	const frame = new Instance("Frame");
	frame.Name = `Panel_${id}`;
	frame.AnchorPoint = new Vector2(0.5, 0.5);
	frame.Position = new UDim2(0.5, 0, 0.5, 0);
	frame.Size = new UDim2(0.9, 0, 0.75, 0);
	frame.BackgroundColor3 = THEME.background;
	round(frame, 12);
	const limit = new Instance("UISizeConstraint");
	limit.MaxSize = new Vector2(480, 600);
	limit.Parent = frame;

	const header = makeLabel(frame, title, { size: 22, bold: true, color: THEME.accent });
	header.Position = new UDim2(0, 16, 0, 12);
	header.Size = new UDim2(1, -70, 0, 28);
	header.AutomaticSize = Enum.AutomaticSize.None;

	const close = new Instance("TextButton");
	close.Text = "X";
	close.Font = Enum.Font.GothamBold;
	close.TextSize = 18;
	close.TextColor3 = THEME.text;
	close.BackgroundColor3 = THEME.danger;
	close.Size = new UDim2(0, 36, 0, 36);
	close.Position = new UDim2(1, -48, 0, 8);
	round(close, 6);
	close.Activated.Connect(closePanel);
	close.Parent = frame;

	const content = new Instance("ScrollingFrame");
	content.BackgroundTransparency = 1;
	content.BorderSizePixel = 0;
	content.Position = new UDim2(0, 0, 0, 52);
	content.Size = new UDim2(1, 0, 1, -60);
	content.CanvasSize = new UDim2(0, 0, 0, 0);
	content.AutomaticCanvasSize = Enum.AutomaticSize.Y;
	content.ScrollBarThickness = 6;
	pad(content, 12);
	list(content, Enum.FillDirection.Vertical, 8);
	content.Parent = frame;

	frame.Parent = getGui();
	current = { id, frame, content, render };
	render(content);
}

// ---------------------------------------------------------------- toasts

let toastHolder: Frame | undefined;

function getToastHolder(): Frame {
	if (toastHolder === undefined) {
		const holder = new Instance("Frame");
		holder.BackgroundTransparency = 1;
		holder.AnchorPoint = new Vector2(0.5, 0);
		holder.Position = new UDim2(0.5, 0, 0, 60);
		holder.Size = new UDim2(0, 360, 0, 0);
		holder.AutomaticSize = Enum.AutomaticSize.Y;
		list(holder, Enum.FillDirection.Vertical, 6);
		holder.Parent = getGui();
		toastHolder = holder;
	}
	return toastHolder;
}

export function toast(text: string, kind: NotifyKind = "info", seconds = 3): void {
	const color = kind === "success" ? THEME.success : kind === "error" ? THEME.danger : THEME.surface;
	const card = new Instance("TextLabel");
	card.Size = new UDim2(1, 0, 0, 0);
	card.AutomaticSize = Enum.AutomaticSize.Y;
	card.BackgroundColor3 = color;
	card.TextColor3 = THEME.text;
	card.Font = Enum.Font.GothamBold;
	card.TextSize = 16;
	card.TextWrapped = true;
	card.Text = text;
	card.LayoutOrder = order();
	round(card);
	pad(card, 8);
	card.Parent = getToastHolder();
	task.delay(seconds, () => card.Destroy());
}

// ---------------------------------------------------------------- HUD

let hud: Frame | undefined;
let hudButtons: Frame | undefined;

/** Top-left column of short status lines (money, bag, bonuses). */
export function getHud(): Frame {
	if (hud === undefined) {
		const frame = new Instance("Frame");
		frame.Name = "Hud";
		frame.BackgroundColor3 = THEME.background;
		frame.BackgroundTransparency = 0.25;
		frame.Position = new UDim2(0, 12, 0, 60);
		frame.Size = new UDim2(0, 240, 0, 0);
		frame.AutomaticSize = Enum.AutomaticSize.Y;
		round(frame);
		pad(frame, 8);
		list(frame, Enum.FillDirection.Vertical, 4);
		frame.Parent = getGui();
		hud = frame;
	}
	return hud;
}

/** Bottom-left row of buttons that open panels which are not tied to a place (equipment, bonuses). */
export function getHudButtons(): Frame {
	if (hudButtons === undefined) {
		const frame = new Instance("Frame");
		frame.Name = "HudButtons";
		frame.BackgroundTransparency = 1;
		frame.AnchorPoint = new Vector2(0, 1);
		frame.Position = new UDim2(0, 12, 1, -12);
		frame.Size = new UDim2(0, 150, 0, 0);
		frame.AutomaticSize = Enum.AutomaticSize.Y;
		list(frame, Enum.FillDirection.Vertical, 6);
		frame.Parent = getGui();
		hudButtons = frame;
	}
	return hudButtons;
}
