// What the UI shows about a bought machine: its upgrade tracks and the progress bar above it. Pure and read-only:
// nothing here changes the line, the server stays the only one that does.
import { LINE_MACHINES, LINE_UPGRADES, LINE_UPGRADE_TRACKS, LineUpgradeTrack } from "shared/config/line";
import { formatPercent } from "shared/lib/format";
import { LineState, NextLineUpgrade, nextLineUpgrade, queueLimit, upgradeValue } from "./line";

export interface UpgradeRow {
	readonly track: LineUpgradeTrack;
	readonly level: number;
	readonly maxLevel: number;
	/** The track's value at the current level (see LineUpgradeLevel). */
	readonly value: number;
	/** The next level, or undefined when the track is maxed. */
	readonly upgrade?: NextLineUpgrade;
}

/** One row per upgrade track of bought machine `index` (0-based); empty for a machine that is not bought. */
export function upgradeRows(state: LineState, index: number): UpgradeRow[] {
	const machine = state.machines[index];
	if (machine === undefined) {
		return [];
	}
	return LINE_UPGRADE_TRACKS.map((track) => ({
		track,
		level: machine[track],
		maxLevel: LINE_UPGRADES[track].size(),
		value: upgradeValue(track, machine[track]),
		upgrade: nextLineUpgrade(state, index, track),
	}));
}

/** A track value as the player reads it: "×1.25" for speed and quality, "5%" for double output, "20" for capacity. */
export function formatUpgradeValue(track: LineUpgradeTrack, value: number): string {
	if (track === "duplicate") {
		return formatPercent(value);
	}
	return track === "capacity" ? `${value}` : `×${value}`;
}

export type GaugeStatus = "idle" | "working" | "stalled";

export interface MachineGauge {
	readonly status: GaugeStatus;
	/** 0..1 of the item being processed. */
	readonly fraction: number;
	readonly queued: number;
	readonly limit: number;
}

/**
 * The bar above machine `index`. `elapsed` is the time since the state arrived from the server: the bar keeps moving
 * between updates, but never past a finished item. "stalled" = finished, and the next machine's queue is full.
 */
export function machineGauge(state: LineState, index: number, elapsed: number): MachineGauge | undefined {
	const machine = state.machines[index];
	const def = LINE_MACHINES[index];
	if (machine === undefined || def === undefined) {
		return undefined;
	}
	const queued = machine.queue.size();
	const limit = queueLimit(state, index);
	if (queued === 0) {
		return { status: "idle", fraction: 0, queued, limit };
	}
	const nextFull =
		state.machines[index + 1] !== undefined &&
		state.machines[index + 1].queue.size() >= queueLimit(state, index + 1);
	if (nextFull && machine.progress >= def.seconds) {
		return { status: "stalled", fraction: 1, queued, limit };
	}
	const since = elapsed === elapsed ? math.max(elapsed, 0) : 0; // NaN counts as no time
	const done = machine.progress + since * upgradeValue("speed", machine.speed);
	return { status: "working", fraction: math.clamp(done / def.seconds, 0, 1), queued, limit };
}
