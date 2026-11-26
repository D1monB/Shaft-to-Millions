// The card above every bought machine of the player's own plot (redesigned, decision 068): what it is doing (a status
// dot and word), how far the current item is (a bar with percent) and how full its queue is (a bar with the count).
// Drawn from the player's own line state, so it needs no extra network traffic. At most 12 small billboards.
import { CollectionService, RunService } from "@rbxts/services";
import { LINE_BASE_SPEED, LINE_MACHINES } from "shared/config/line";
import { PLOT_ATTRIBUTES } from "shared/config/map-contract";
import { nameKeys } from "shared/features/i18n";
import { LABEL_HEIGHT_ATTRIBUTE, MachineGauge, UPGRADE_POINT_TAG, beltSpeed, machineGauge } from "shared/features/line";
import { getView, onViewChanged } from "client/features/profile";
import { t } from "client/lib/i18n";
import { COLORS, FONTS } from "client/lib/ui-kit";
import { isOnOwnPlot } from "./own-plot";

const UPDATE_SECONDS = 0.1;
const CARD_SIZE = UDim2.fromOffset(180, 74);
/** Farther than this the cards are hidden, so a row of machines does not turn into a wall of labels. */
const MAX_DISTANCE = 70;
const GAUGE_NAME = "MachineGauge";

const STATUS_COLORS = {
	idle: Color3.fromRGB(150, 150, 160),
	working: Color3.fromRGB(90, 220, 120),
	stalled: Color3.fromRGB(255, 110, 80),
} as const;
const QUEUE_COLOR = Color3.fromRGB(80, 170, 255);
const QUEUE_FULL_COLOR = Color3.fromRGB(255, 170, 50);

interface Bar {
	readonly fill: Frame;
	readonly text: TextLabel;
}

interface Gauge {
	readonly gui: BillboardGui;
	readonly stroke: UIStroke;
	readonly dot: Frame;
	readonly title: TextLabel;
	readonly status: TextLabel;
	readonly work: Bar;
	readonly queue: Bar;
}

const gauges = new Map<Instance, Gauge>();
/** os.clock() when the latest state arrived: the bars keep moving from there until the next one. */
let receivedAt = os.clock();

function make<K extends keyof CreatableInstances>(
	className: K,
	parent: Instance,
	props: Partial<WritableInstanceProperties<CreatableInstances[K]>>,
): CreatableInstances[K] {
	const instance = new Instance(className);
	for (const [key, value] of pairs(props as unknown as Record<string, never>)) {
		(instance as unknown as Record<string, never>)[key as string] = value;
	}
	instance.Parent = parent;
	return instance;
}

function round(parent: Instance, radius: UDim): void {
	make("UICorner", parent, { CornerRadius: radius });
}

function label(parent: Instance, position: UDim2, size: UDim2, textSize: number, alignment: Enum.TextXAlignment) {
	return make("TextLabel", parent, {
		BackgroundTransparency: 1,
		Position: position,
		Size: size,
		Font: FONTS.display,
		TextSize: textSize,
		TextColor3: COLORS.white,
		TextStrokeTransparency: 0.4,
		TextXAlignment: alignment,
		TextTruncate: Enum.TextTruncate.AtEnd,
		ZIndex: 3,
		Text: "",
	});
}

/** A rounded track with a gradient fill and a centred text. */
function bar(parent: Instance, y: number, height: number): Bar {
	const track = make("Frame", parent, {
		Position: new UDim2(0, 8, 0, y),
		Size: new UDim2(1, -16, 0, height),
		BackgroundColor3: Color3.fromRGB(12, 12, 18),
		BorderSizePixel: 0,
	});
	round(track, new UDim(0, 6));
	const fill = make("Frame", track, { Size: new UDim2(0, 0, 1, 0), BorderSizePixel: 0, ZIndex: 2 });
	round(fill, new UDim(0, 6));
	make("UIGradient", fill, {
		Rotation: 90,
		Color: new ColorSequence(Color3.fromRGB(255, 255, 255), Color3.fromRGB(170, 170, 170)),
	});
	const text = label(track, new UDim2(0, 0, 0, 0), new UDim2(1, 0, 1, 0), height - 2, Enum.TextXAlignment.Center);
	return { fill, text };
}

function createGauge(anchor: BasePart): Gauge {
	const height = anchor.GetAttribute(LABEL_HEIGHT_ATTRIBUTE);
	const gui = new Instance("BillboardGui");
	gui.Name = GAUGE_NAME;
	gui.Size = CARD_SIZE;
	gui.StudsOffsetWorldSpace = new Vector3(0, typeIs(height, "number") ? height : 6, 0);
	gui.MaxDistance = MAX_DISTANCE;
	gui.LightInfluence = 0;
	// The card is often inside a tall machine's body (its height is capped), so it is drawn over the model.
	gui.AlwaysOnTop = true;
	gui.ResetOnSpawn = false;

	const card = make("Frame", gui, {
		Size: new UDim2(1, 0, 1, 0),
		BackgroundColor3: Color3.fromRGB(24, 22, 32),
		BackgroundTransparency: 0.12,
		BorderSizePixel: 0,
	});
	round(card, new UDim(0, 10));
	const stroke = make("UIStroke", card, { Thickness: 2, Color: STATUS_COLORS.idle });

	const dot = make("Frame", card, {
		Position: new UDim2(0, 8, 0, 9),
		Size: new UDim2(0, 10, 0, 10),
		BorderSizePixel: 0,
	});
	round(dot, new UDim(1, 0));
	const title = label(card, new UDim2(0, 24, 0, 4), new UDim2(1, -96, 0, 20), 15, Enum.TextXAlignment.Left);
	const status = label(card, new UDim2(1, -72, 0, 4), new UDim2(0, 64, 0, 20), 12, Enum.TextXAlignment.Right);
	const work = bar(card, 28, 18);
	const queue = bar(card, 52, 15);

	gui.Parent = anchor; // created on this client only; it goes away with the anchor
	return { gui, stroke, dot, title, status, work, queue };
}

function draw(gauge: Gauge, state: MachineGauge, machineIndex: number): void {
	const color = STATUS_COLORS[state.status];
	gauge.stroke.Color = color;
	gauge.dot.BackgroundColor3 = color;
	const def = LINE_MACHINES[machineIndex];
	gauge.title.Text = def !== undefined ? t(nameKeys.machine(def.id)) : "";
	gauge.status.Text = t(`line.status.${state.status}`);
	gauge.status.TextColor3 = color;
	gauge.work.fill.Size = new UDim2(state.fraction, 0, 1, 0);
	gauge.work.fill.BackgroundColor3 = color;
	gauge.work.text.Text = state.status === "idle" ? "—" : `${math.floor(state.fraction * 100)}%`;
	const full = state.limit > 0 ? math.clamp(state.queued / state.limit, 0, 1) : 0;
	gauge.queue.fill.Size = new UDim2(full, 0, 1, 0);
	gauge.queue.fill.BackgroundColor3 = full >= 1 ? QUEUE_FULL_COLOR : QUEUE_COLOR;
	gauge.queue.text.Text = `📦 ${state.queued} / ${state.limit}`;
}

function update(): void {
	const view = getView();
	const seen = new Set<Instance>();
	for (const anchor of CollectionService.GetTagged(UPGRADE_POINT_TAG)) {
		const stage = anchor.GetAttribute(PLOT_ATTRIBUTES.Stage);
		if (view === undefined || !anchor.IsA("BasePart") || !typeIs(stage, "number") || !isOnOwnPlot(anchor)) {
			continue;
		}
		// The line runs slower than real time at low conveyor levels, so the bar moves at the same pace.
		const pace = LINE_BASE_SPEED * beltSpeed(view.line.beltLevel);
		const state = machineGauge(view.line, stage - 1, (os.clock() - receivedAt) * pace);
		if (state === undefined) {
			continue;
		}
		let gauge = gauges.get(anchor);
		if (gauge === undefined || gauge.gui.Parent !== anchor) {
			gauge = createGauge(anchor);
			gauges.set(anchor, gauge);
		}
		seen.add(anchor);
		draw(gauge, state, stage - 1);
	}
	// Anchors that were removed (plot released), streamed out or are no longer ours.
	for (const [anchor, gauge] of gauges) {
		if (!seen.has(anchor)) {
			gauge.gui.Destroy();
			gauges.delete(anchor);
		}
	}
}

export function startMachineGauges(): void {
	onViewChanged(() => (receivedAt = os.clock()));
	let elapsed = 0;
	RunService.Heartbeat.Connect((dt) => {
		elapsed += dt;
		if (elapsed >= UPDATE_SECONDS) {
			elapsed = 0;
			update();
		}
	});
}
