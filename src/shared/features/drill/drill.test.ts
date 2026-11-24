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
		Assert.true(canDrillOre(1, "coal", 1));
		Assert.false(canDrillOre(1, "quartz", 1));
		Assert.true(canDrillOre(1, "quartz", 2));
		// Ore from another layer is never allowed.
		Assert.false(canDrillOre(1, "gold", 5));
	}

	@Test
	public manualMiningIsMuchFasterThanTheDrill() {
		// Design rule: automation must not make the pickaxe pointless.
		for (const oreId of ["coal", "copper", "iron"] as const) {
			const pickaxe = PICKAXES[0];
			const manualSeconds = hitsRequired(ORES[oreId].hardness, pickaxe.power) * pickaxe.swingSeconds;
			Assert.true(secondsPerPiece(1, oreId) >= manualSeconds * 5, `${oreId} drill too fast`);
		}
	}

	@Test
	public producesOverTimeAndKeepsLeftoverProgress() {
		const state = newDrillState("coal", 0);
		const perPiece = secondsPerPiece(1, "coal");
		Assert.equal(advanceDrill(state, 1, perPiece * 2.5), 2);
		Assert.equal(state.buffer, 2);
		Assert.equal(state.progress, perPiece * 0.5);
		Assert.equal(advanceDrill(state, 1, perPiece * 3), 1);
	}

	@Test
	public stopsWhenTheBufferIsFull() {
		const state = newDrillState("coal", 0);
		advanceDrill(state, 1, 1e6);
		Assert.equal(state.buffer, layerOneDrill().bufferCapacity);
		Assert.equal(advanceDrill(state, 1, 2e6), 0);
		Assert.equal(state.progress, 0);
	}

	@Test
	public offlineTimeIsCapped() {
		const state = newDrillState("coal", 0);
		advanceDrill(state, 1, MAX_OFFLINE_DRILL_SECONDS * 100);
		Assert.true(state.buffer <= layerOneDrill().bufferCapacity);
		Assert.equal(state.lastTick, MAX_OFFLINE_DRILL_SECONDS * 100);
	}

	@Test
	public backwardsClockProducesNothing() {
		const state = newDrillState("coal", 1000);
		Assert.equal(advanceDrill(state, 1, 10), 0);
		Assert.equal(state.lastTick, 1000);
		Assert.equal(advanceDrill(state, 1, 0 / 0), 0);
	}

	@Test
	public conveyorDeliversOnlyWhatFits() {
		const state = newDrillState("iron", 0);
		state.buffer = 10;
		const warehouse: { [id: string]: number | undefined } = {};
		Assert.equal(deliverDrill(state, warehouse, 4), 4);
		Assert.equal(warehouse.iron, 4);
		Assert.equal(state.buffer, 6);
		Assert.equal(deliverDrill(state, warehouse, 0), 0);
		Assert.equal(deliverDrill(state, warehouse, -5), 0);
		Assert.equal(deliverDrill(state, warehouse, 0 / 0), 0);
	}

	@Test
	public switchingOreNeedsAnEmptyBuffer() {
		const state = newDrillState("coal", 0);
		state.buffer = 1;
		Assert.false(selectDrillOre(state, "iron", 5));
		Assert.equal(state.oreId, "coal");
		state.buffer = 0;
		state.progress = 7;
		Assert.true(selectDrillOre(state, "iron", 5));
		Assert.equal(state.oreId, "iron");
		Assert.equal(state.progress, 0);
	}
}

export = DrillTests;
