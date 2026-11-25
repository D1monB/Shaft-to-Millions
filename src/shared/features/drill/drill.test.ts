import { Assert, Test } from "@rbxts/lunit";
import { DRILLS, MAX_OFFLINE_DRILL_SECONDS } from "shared/config/drills";
import { ORES } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { hitsRequired } from "shared/features/mining";
import {
	advanceDrill,
	canDrillOre,
	deliverDrill,
	isDrillUnlocked,
	newDrillState,
	secondsPerPiece,
	selectDrillOre,
} from "./drill";
import { HOPPER_CAPACITY } from "shared/config/line";
import { applyBuyLineMachine, newLineState } from "shared/features/line";

function layerOneDrill() {
	const def = DRILLS[1];
	if (def === undefined) {
		error("layer 1 has no drill");
	}
	return def;
}

class DrillTests {
	@Test
	public layerOneDrillExists() {
		Assert.notUndefined(DRILLS[1]);
	}

	@Test
	public unlocksOnlyAfterPassingTheLayer() {
		Assert.false(isDrillUnlocked(1, 1));
		Assert.true(isDrillUnlocked(1, 2));
		Assert.false(isDrillUnlocked(2, 2));
		Assert.false(isDrillUnlocked(99, 99));
	}

	@Test
	public drillsOnlyWhatThePickaxeCouldMine() {
		Assert.true(canDrillOre(1, "copper", 1));
		Assert.false(canDrillOre(2, "iron", 1));
		Assert.true(canDrillOre(2, "iron", 2));
		// Ore from another layer is never allowed.
		Assert.false(canDrillOre(1, "gold", 5));
	}

	@Test
	public manualMiningIsMuchFasterThanTheDrill() {
		// Design rule: automation must not make the pickaxe pointless.
		for (const oreId of ["copper"] as const) {
			const pickaxe = PICKAXES[0];
			const manualSeconds = hitsRequired(ORES[oreId].hardness, pickaxe.power) * pickaxe.swingSeconds;
			Assert.true(secondsPerPiece(1, oreId) >= manualSeconds * 5, `${oreId} drill too fast`);
		}
	}

	@Test
	public producesOverTimeAndKeepsLeftoverProgress() {
		const state = newDrillState("copper", 0);
		const perPiece = secondsPerPiece(1, "copper");
		Assert.equal(advanceDrill(state, 1, perPiece * 2.5), 2);
		Assert.equal(state.buffer, 2);
		Assert.equal(state.progress, perPiece * 0.5);
		Assert.equal(advanceDrill(state, 1, perPiece * 3), 1);
	}

	@Test
	public stopsWhenTheBufferIsFull() {
		const state = newDrillState("copper", 0);
		advanceDrill(state, 1, 1e6);
		Assert.equal(state.buffer, layerOneDrill().bufferCapacity);
		Assert.equal(advanceDrill(state, 1, 2e6), 0);
		Assert.equal(state.progress, 0);
	}

	@Test
	public offlineTimeIsCapped() {
		const state = newDrillState("copper", 0);
		advanceDrill(state, 1, MAX_OFFLINE_DRILL_SECONDS * 100);
		Assert.true(state.buffer <= layerOneDrill().bufferCapacity);
		Assert.equal(state.lastTick, MAX_OFFLINE_DRILL_SECONDS * 100);
	}

	@Test
	public backwardsClockProducesNothing() {
		const state = newDrillState("copper", 1000);
		Assert.equal(advanceDrill(state, 1, 10), 0);
		Assert.equal(state.lastTick, 1000);
		Assert.equal(advanceDrill(state, 1, 0 / 0), 0);
	}

	@Test
	public conveyorDeliversOnlyWhatFits() {
		const state = newDrillState("iron", 0);
		state.buffer = 10;
		// The belt always exists, so a drill delivers even before any machine is bought, up to the intake room.
		const line = newLineState();
		for (let i = 0; i < HOPPER_CAPACITY - 4; i++) {
			line.intake.push("copper");
		}
		Assert.equal(deliverDrill(state, line), 4);
		Assert.equal(state.buffer, 6);
		Assert.equal(line.intake[HOPPER_CAPACITY - 1], "iron");
		Assert.equal(deliverDrill(state, line), 0, "a full intake takes nothing");
	}

	@Test
	public conveyorIgnoresABrokenBuffer() {
		const line = newLineState();
		applyBuyLineMachine(line);
		const state = newDrillState("iron", 0);
		for (const buffer of [-5, 0 / 0, math.huge]) {
			state.buffer = buffer;
			Assert.equal(deliverDrill(state, line), 0);
		}
		Assert.equal(line.intake.size(), 0);
	}

	@Test
	public switchingOreNeedsAnEmptyBuffer() {
		const state = newDrillState("copper", 0);
		state.buffer = 1;
		Assert.false(selectDrillOre(state, "iron", 5));
		Assert.equal(state.oreId, "copper");
		state.buffer = 0;
		state.progress = 7;
		Assert.true(selectDrillOre(state, "iron", 5));
		Assert.equal(state.oreId, "iron");
		Assert.equal(state.progress, 0);
	}
}

export = DrillTests;
