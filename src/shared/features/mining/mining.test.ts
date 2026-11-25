import { Assert, Test } from "@rbxts/lunit";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { MiningSession, canMineTier, getPickaxe, hitsRequired, rollYield } from "./mining";

const IRON_PICK = PICKAXES[0];
// The first pickaxe that opens tier 2 ore. The fallback only satisfies the type checker: config tests catch a gap.
const STEEL_PICK = PICKAXES.find((pickaxe) => pickaxe.tier === 2) ?? PICKAXES[0];

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
	public everyPickaxeCanHitAndTheStarterIsFree() {
		// The main line getting stronger is checked in upgrades.test.ts; side items may trade power for speed.
		for (const pickaxe of PICKAXES) {
			Assert.true(pickaxe.power > 0 && pickaxe.swingSeconds > 0 && pickaxe.tier >= 1);
		}
		Assert.equal(PICKAXES[0].price, 0);
		Assert.equal(PICKAXES[0].tier, 1);
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
		Assert.equal(getPickaxe(IRON_PICK.id), IRON_PICK);
		Assert.equal(getPickaxe(STEEL_PICK.id), STEEL_PICK);
		// Unknown ids (broken save, item from a newer server, an id of another slot) fall back to the starter.
		Assert.equal(getPickaxe(""), IRON_PICK);
		Assert.equal(getPickaxe("bag_sack"), IRON_PICK);
		Assert.equal(getPickaxe("pickaxe_future"), IRON_PICK);
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

	@Test
	public swappingToAFastPickaxeRightAfterAHitIsStillOnCooldown() {
		// Regression: the hammer (slow, strong) then the light pickaxe (fast) must not give two hits at once.
		const hammer = getPickaxe("pickaxe_hammer");
		const light = getPickaxe("pickaxe_light");
		Assert.true(hammer.swingSeconds > light.swingSeconds);
		const session = new MiningSession<string>();
		Assert.equal(session.hit("a", ORES.coal, hammer, 10).kind, "broken");
		Assert.equal(session.hit("b", ORES.coal, light, 10 + light.swingSeconds * 0.5).kind, "cooldown");
		Assert.notEqual(session.hit("b", ORES.coal, light, 10 + light.swingSeconds).kind, "cooldown");
	}
}

export = MiningTests;
