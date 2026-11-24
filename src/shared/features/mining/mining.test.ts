import { Assert, Test } from "@rbxts/lunit";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { MiningSession, canMineTier, getPickaxe, hitsRequired, rollYield } from "./mining";

const IRON_PICK = PICKAXES[0];
const STEEL_PICK = PICKAXES[1];

class MiningTests {
	// ---- config sanity: a broken config would silently ruin progression ----

	@Test
	public everyOreIsMinableBySomePickaxe() {
		const best = PICKAXES[PICKAXES.size() - 1];
		for (const id of ORE_IDS) {
			Assert.true(canMineTier(ORES[id], best), `${id} cannot be mined by any pickaxe`);
		}
	}

	@Test
	public pickaxesGetStrictlyBetterAndPricier() {
		for (let i = 1; i < PICKAXES.size(); i++) {
			Assert.true(PICKAXES[i].tier > PICKAXES[i - 1].tier);
			Assert.true(PICKAXES[i].power > PICKAXES[i - 1].power);
			Assert.true(PICKAXES[i].price > PICKAXES[i - 1].price);
			Assert.true(PICKAXES[i].swingSeconds > 0);
		}
		Assert.equal(PICKAXES[0].price, 0);
	}

	@Test
	public layerOneStartsWithCheapMinableOre() {
		// Decision 002: coal, copper, iron on layer 1, all minable with the starter pickaxe.
		for (const id of ["coal", "copper", "iron"] as const) {
			Assert.equal(ORES[id].layer, 1);
			Assert.true(canMineTier(ORES[id], IRON_PICK));
		}
		Assert.equal(hitsRequired(ORES.coal.hardness, IRON_PICK.power), 2);
		Assert.equal(hitsRequired(ORES.copper.hardness, IRON_PICK.power), 3);
		Assert.equal(hitsRequired(ORES.iron.hardness, IRON_PICK.power), 5);
	}

	// ---- tool tiers ----

	@Test
	public weakPickaxeCannotMineLockedOre() {
		Assert.false(canMineTier(ORES.quartz, IRON_PICK));
		Assert.true(canMineTier(ORES.quartz, STEEL_PICK));
		const session = new MiningSession<string>();
		const result = session.hit("q", ORES.quartz, IRON_PICK, 0);
		Assert.equal(result.kind, "locked");
		if (result.kind === "locked") {
			Assert.equal(result.requiredTier, 2);
		}
	}

	@Test
	public betterPickaxeNeedsFewerHits() {
		Assert.equal(hitsRequired(5, 1), 5);
		Assert.equal(hitsRequired(5, 2), 3);
		Assert.equal(hitsRequired(5, 100), 1);
	}

	@Test
	public hitsRequiredSurvivesBadInput() {
		Assert.equal(hitsRequired(5, 0), math.huge);
		Assert.equal(hitsRequired(5, -1), math.huge);
		Assert.equal(hitsRequired(5, 0 / 0), math.huge);
		Assert.equal(hitsRequired(0, 1), 1);
	}

	@Test
	public getPickaxeClampsLevels() {
		Assert.equal(getPickaxe(1), IRON_PICK);
		Assert.equal(getPickaxe(0), IRON_PICK);
		Assert.equal(getPickaxe(-5), IRON_PICK);
		Assert.equal(getPickaxe(0 / 0), IRON_PICK);
		Assert.equal(getPickaxe(999), PICKAXES[PICKAXES.size() - 1]);
		Assert.equal(getPickaxe(2.9), STEEL_PICK);
	}

	// ---- node lifecycle ----

	@Test
	public nodeBreaksAfterEnoughHitsThenRespawns() {
		const session = new MiningSession<string>();
		const ore = ORES.copper; // 3 hits with the starter pickaxe
		Assert.equal(session.hit("n", ore, IRON_PICK, 0).kind, "progress");
		Assert.equal(session.hit("n", ore, IRON_PICK, 1).kind, "progress");
		Assert.equal(session.hit("n", ore, IRON_PICK, 2).kind, "broken");
		Assert.true(session.isDepleted("n", 2 + ore.respawnSeconds - 0.1));
		Assert.equal(session.hit("n", ore, IRON_PICK, 3).kind, "depleted");
		Assert.false(session.isDepleted("n", 2 + ore.respawnSeconds));
		Assert.equal(session.hit("n", ore, IRON_PICK, 2 + ore.respawnSeconds).kind, "progress");
	}

	@Test
	public nodesAreIndependent() {
		const session = new MiningSession<string>();
		session.hit("a", ORES.coal, IRON_PICK, 0);
		const other = session.hit("b", ORES.coal, IRON_PICK, 1);
		Assert.equal(other.kind, "progress");
	}

	@Test
	public sessionsArePerPlayer() {
		// Player A breaking a node must not deplete it for player B.
		const a = new MiningSession<string>();
		const b = new MiningSession<string>();
		a.hit("n", ORES.coal, IRON_PICK, 0);
		a.hit("n", ORES.coal, IRON_PICK, 1);
		Assert.true(a.isDepleted("n", 1.5));
		Assert.false(b.isDepleted("n", 1.5));
		Assert.equal(b.hit("n", ORES.coal, IRON_PICK, 1.5).kind, "progress");
	}

	// ---- anti-cheat: spam and clocks ----

	@Test
	public autoClickerSpamIsCappedBySwingTime() {
		const session = new MiningSession<string>();
		let counted = 0;
		// 1000 clicks within one second.
		for (let i = 0; i < 1000; i++) {
			const result = session.hit("n", ORES.iron, IRON_PICK, i / 1000);
			if (result.kind !== "cooldown") {
				counted += 1;
			}
		}
		// 0.5s swing with 0.8 tolerance -> one hit every 0.4s -> at most 3 hits in [0, 1).
		Assert.true(counted <= 3, `counted ${counted}`);
	}

	@Test
	public backwardsClockGivesNoFreeHits() {
		const session = new MiningSession<string>();
		session.hit("n", ORES.iron, IRON_PICK, 100);
		Assert.equal(session.hit("n", ORES.iron, IRON_PICK, 50).kind, "cooldown");
	}

	@Test
	public lockedOreDoesNotConsumeTheSwing() {
		// Clicking a locked node by mistake must not delay the next real hit.
		const session = new MiningSession<string>();
		session.hit("q", ORES.quartz, IRON_PICK, 0);
		Assert.equal(session.hit("c", ORES.coal, IRON_PICK, 0).kind, "progress");
	}

	// ---- yield ----

	@Test
	public yieldWithoutBonusIsOne() {
		Assert.equal(rollYield(0, 0), 1);
		Assert.equal(rollYield(0, 0.99), 1);
	}

	@Test
	public fractionalBonusIsAChance() {
		Assert.equal(rollYield(0.3, 0.1), 2);
		Assert.equal(rollYield(0.3, 0.5), 1);
		Assert.equal(rollYield(1.5, 0.4), 3);
		Assert.equal(rollYield(1.5, 0.6), 2);
	}

	@Test
	public yieldIgnoresHostileBonus() {
		Assert.equal(rollYield(-5, 0), 1);
		Assert.equal(rollYield(0 / 0, 0), 1);
		// Capped so a data bug can never print infinite ore.
		Assert.equal(rollYield(math.huge, 0.99), 11);
	}
}

export = MiningTests;
