import { Assert, Test } from "@rbxts/lunit";
import { LINE_MACHINES, LINE_UPGRADES } from "shared/config/line";
import { LineState, applyBuyLineMachine, applyLineUpgrade, newLineState, queueLimit } from "./line";
import { formatUpgradeValue, machineGauge, upgradeRows } from "./line-view";

function lineWith(machines: number): LineState {
	const state = newLineState();
	for (let i = 0; i < machines; i++) {
		applyBuyLineMachine(state);
	}
	return state;
}

class LineViewTests {
	@Test
	public newMachineHasFourRowsAtLevelOne() {
		const rows = upgradeRows(lineWith(1), 0);
		Assert.equal(4, rows.size());
		for (const row of rows) {
			Assert.equal(1, row.level);
			Assert.equal(LINE_UPGRADES[row.track].size(), row.maxLevel);
			Assert.equal(LINE_UPGRADES[row.track][0].value, row.value);
			Assert.equal(2, row.upgrade?.level);
		}
	}

	@Test
	public maxedTrackHasNoNextLevel() {
		const state = lineWith(1);
		for (let i = 0; i < 10; i++) {
			applyLineUpgrade(state, 0, "speed");
		}
		const speed = upgradeRows(state, 0).find((row) => row.track === "speed");
		Assert.equal(LINE_UPGRADES.speed.size(), speed?.level);
		Assert.undefined(speed?.upgrade);
	}

	@Test
	public notBoughtOrBrokenIndexHasNoRowsAndNoGauge() {
		const state = lineWith(1);
		for (const index of [1, -1, 0.5, 99, math.huge, 0 / 0]) {
			Assert.equal(0, upgradeRows(state, index).size());
			Assert.undefined(machineGauge(state, index, 0));
		}
	}

	@Test
	public valuesReadLikeThePlayerExpects() {
		Assert.equal("×1.25", formatUpgradeValue("speed", 1.25));
		Assert.equal("×1.05", formatUpgradeValue("quality", 1.05));
		Assert.equal("5%", formatUpgradeValue("duplicate", 0.05));
		Assert.equal("20", formatUpgradeValue("capacity", 20));
	}

	@Test
	public emptyQueueIsIdle() {
		const gauge = machineGauge(lineWith(1), 0, 100);
		Assert.equal("idle", gauge?.status);
		Assert.equal(0, gauge?.fraction);
	}

	@Test
	public barMovesBetweenUpdatesAndStopsAtFull() {
		const state = lineWith(1);
		state.machines[0].queue.push("copper");
		const seconds = LINE_MACHINES[0].seconds;
		Assert.equal(0.5, machineGauge(state, 0, seconds / 2)?.fraction);
		Assert.equal(1, machineGauge(state, 0, seconds * 50)?.fraction);
		Assert.equal("working", machineGauge(state, 0, seconds * 50)?.status);
		Assert.equal(1, machineGauge(state, 0, 0)?.queued);
	}

	@Test
	public brokenElapsedTimeDoesNotBreakTheBar() {
		const state = lineWith(1);
		state.machines[0].queue.push("copper");
		Assert.equal(0, machineGauge(state, 0, 0 / 0)?.fraction);
		Assert.equal(0, machineGauge(state, 0, -5)?.fraction);
		Assert.equal(1, machineGauge(state, 0, math.huge)?.fraction);
	}

	@Test
	public finishedItemWithFullNextQueueIsStalled() {
		const state = lineWith(2);
		state.machines[0].queue.push("copper");
		state.machines[0].progress = LINE_MACHINES[0].seconds;
		for (let i = 0; i < queueLimit(state, 1); i++) {
			state.machines[1].queue.push("copper");
		}
		Assert.equal("stalled", machineGauge(state, 0, 0)?.status);
		state.machines[1].queue.pop();
		Assert.equal("working", machineGauge(state, 0, 0)?.status);
	}
}

export = LineViewTests;
