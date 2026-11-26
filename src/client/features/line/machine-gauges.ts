// The progress bar above every bought machine of the player's own plot: how far the current item is and how many
// wait. Drawn from the player's own line state, so it needs no extra network traffic. At most 12 small billboards.
import { CollectionService, RunService } from "@rbxts/services";
import { PLOT_ATTRIBUTES } from "shared/config/map-contract";
import { LABEL_HEIGHT_ATTRIBUTE, MachineGauge, UPGRADE_POINT_TAG, machineGauge } from "shared/features/line";
import { getView, onViewChanged } from "client/features/profile";
import { t } from "client/lib/i18n";
import { COLORS, FONTS } from "client/lib/ui-kit";
import { isOnOwnPlot } from "./own-plot";

const UPDATE_SECONDS = 0.1;
const GAUGE_SIZE = UDim2.fromOffset(132, 34);
/** Farther than this the bars are hidden, so a row of machines does not turn into a wall of labels. */
const MAX_DISTANCE = 70;
const GAUGE_NAME = "MachineGauge";

interface Gauge {
	readonly gui: BillboardGui;
	readonly label: TextLabel;
	readonly fill: Frame;
}

const gauges = new Map<Instance, Gauge>();
/** os.clock() when the latest state arrived: the bars keep moving from there until the next one. */
let receivedAt = os.clock();

function corner(parent: Instance): void {
	const round = new Instance("UICorner");
	round.CornerRadius = new UDim(1, 0);
	round.Parent = parent;
}

function createGauge(anchor: BasePart): Gauge {
	const height = anchor.GetAttribute(LABEL_HEIGHT_ATTRIBUTE);
	const gui = new Instance("BillboardGui");
	gui.Name = GAUGE_NAME;
	gui.Size = GAUGE_SIZE;
	gui.StudsOffsetWorldSpace = new Vector3(0, typeIs(height, "number") ? height : 6, 0);
	gui.MaxDistance = MAX_DISTANCE;
	gui.LightInfluence = 0;
	gui.ResetOnSpawn = false;

	const label = new Instance("TextLabel");
	label.BackgroundTransparency = 1;
	label.Size = new UDim2(1, 0, 0, 20);
	label.Font = FONTS.display;
	label.TextSize = 16;
	label.TextColor3 = COLORS.white;
	label.TextStrokeTransparency = 0.3;
	label.Parent = gui;

	const track = new Instance("Frame");
	track.Position = new UDim2(0, 0, 0, 22);
	track.Size = new UDim2(1, 0, 0, 10);
	track.BackgroundColor3 = COLORS.outline;
	track.BackgroundTransparency = 0.2;
	track.BorderSizePixel = 0;
	corner(track);
	track.Parent = gui;

	const fill = new Instance("Frame");
	fill.BorderSizePixel = 0;
	corner(fill);
	fill.Parent = track;

	gui.Parent = anchor; // created on this client only; it goes away with the anchor
	return { gui, label, fill };
}

function draw(gauge: Gauge, state: MachineGauge): void {
	const count = `${state.queued}/${state.limit}`;
	let text = count;
	if (state.status === "idle") {
		text = t("line.gaugeIdle");
	} else if (state.status === "stalled") {
		text = `${t("line.gaugeStalled")} ${count}`;
	}
	gauge.label.Text = text;
	gauge.fill.Size = new UDim2(state.fraction, 0, 1, 0);
	gauge.fill.BackgroundColor3 = state.status === "stalled" ? COLORS.canyon : COLORS.success;
}

function update(): void {
	const view = getView();
	const seen = new Set<Instance>();
	for (const anchor of CollectionService.GetTagged(UPGRADE_POINT_TAG)) {
		const stage = anchor.GetAttribute(PLOT_ATTRIBUTES.Stage);
		if (view === undefined || !anchor.IsA("BasePart") || !typeIs(stage, "number") || !isOnOwnPlot(anchor)) {
			continue;
		}
		const state = machineGauge(view.line, stage - 1, os.clock() - receivedAt);
		if (state === undefined) {
			continue;
		}
		let gauge = gauges.get(anchor);
		if (gauge === undefined || gauge.gui.Parent !== anchor) {
			gauge = createGauge(anchor);
			gauges.set(anchor, gauge);
		}
		seen.add(anchor);
		draw(gauge, state);
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
