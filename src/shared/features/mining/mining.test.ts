import { Assert, Test } from "@rbxts/lunit";
import { ORES, ORE_IDS, OreDef } from "shared/config/ores";
import { PICKAXES, PickaxeDef } from "shared/config/pickaxes";
import { HitResult, MiningSession, canMineTier, getPickaxe, hitsRequired, scaleYield } from "./mining";
import { SWING_TOLERANCE } from "./tuning";

const STARTER = PICKAXES[0];
// The first pickaxe that opens tier 2 ore. The fallback only satisfies the type checker: config tests catch a gap.
const TIER2_PICK = PICKAXES.find((pickaxe) => pickaxe.tier === 2) ?? PICKAXES[0];

/** Pieces a hit gave, or -1 when it was refused. */
function piecesOf(result: HitResult): number {
	return result.kind === "chip" || result.kind === "broken" ? result.pieces : -1;
}

/** Hits the block once a second (far apart, so the swing cooldown never matters) until it breaks. */
function mineOut(session: MiningSession<string>, node: string, ore: OreDef, pickaxe: PickaxeDef, start: number) {
	let pieces = 0;
	let hits = 0;
	for (let i = 0; i < 1000; i++) {
		const result = session.hit(node, ore, pickaxe, start + i);
		hits += 1;
		pieces += math.max(piecesOf(result), 0);
		if (result.kind === "broken") {
			return { pieces, hits, endedAt: start + i };
		}
	}
	return { pieces, hits, endedAt: -1 };
}

const SOFT: OreDef = { ...ORES.copper, hardness: 3, pieces: 2 };

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
		// Decision 027: copper on layer 1, minable with the starter pickaxe.
		const layerOne = ORE_IDS.filter((id) => ORES[id].layer === 1);
		Assert.true(layerOne.size() > 0);
		for (const id of layerOne) {
			Assert.true(canMineTier(ORES[id], STARTER), `${id} needs a better pickaxe than the starter`);
		}
	}

	@Test
	public theFirstPickaxeOfATierChipsOreOnEveryHit() {
		// Decision 052: "ore on every hit". Iridium is the only ore meant to need a better pickaxe than its tier's first.
		for (const id of ORE_IDS) {
			const ore = ORES[id];
			const first = PICKAXES.find((pickaxe) => pickaxe.tier >= ore.requiredTier);
			Assert.notEqual(first, undefined);
			if (first !== undefined && id !== "iridium") {
				Assert.equal(hitsRequired(ore.hardness, first.power), 1, `${id} with ${first.id}`);
			}
			Assert.true(ore.pieces >= 1 && math.floor(ore.pieces) === ore.pieces, `${id} pieces`);
		}
	}

	// ---- tool tiers ----

	@Test
	public weakPickaxeCannotMineLockedOre() {
		Assert.false(canMineTier(ORES.iron, STARTER));
		Assert.true(canMineTier(ORES.iron, TIER2_PICK));
		const session = new MiningSession<string>();
		const result = session.hit("q", ORES.iron, STARTER, 0);
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
		Assert.equal(getPickaxe(STARTER.id), STARTER);
		Assert.equal(getPickaxe(TIER2_PICK.id), TIER2_PICK);
		// Unknown ids (broken save, item from a newer server, an id of another slot) fall back to the starter.
		Assert.equal(getPickaxe(""), STARTER);
		Assert.equal(getPickaxe("bag_sack"), STARTER);
		Assert.equal(getPickaxe("pickaxe_future"), STARTER);
	}

	// ---- chipping a block ----

	@Test
	public everyHitChipsAPieceUntilTheBlockIsEmpty() {
		const session = new MiningSession<string>();
		const ore = ORES.copper;
		for (let i = 0; i < ore.pieces - 1; i++) {
			const result = session.hit("n", ore, STARTER, i);
			Assert.equal(result.kind, "chip");
			Assert.equal(piecesOf(result), 1);
		}
		const last = session.hit("n", ore, STARTER, ore.pieces);
		Assert.equal(last.kind, "broken");
		Assert.equal(piecesOf(last), 1);
	}

	@Test
	public aBlockNeverGivesMoreThanItHolds() {
		// A pickaxe far stronger than the ore empties the block in one hit, but only takes what is in it.
		const best = PICKAXES[PICKAXES.size() - 1];
		const session = new MiningSession<string>();
		const result = session.hit("n", ORES.copper, best, 0);
		Assert.equal(result.kind, "broken");
		Assert.equal(piecesOf(result), ORES.copper.pieces);
		for (const pickaxe of [STARTER, TIER2_PICK, best]) {
			Assert.equal(mineOut(new MiningSession<string>(), "m", ORES.copper, pickaxe, 0).pieces, ORES.copper.pieces);
		}
	}

	@Test
	public damageBelowOnePieceCarriesOver() {
		// Power 1 against hardness 3: two empty hits, then a piece; nothing is lost between hits.
		const session = new MiningSession<string>();
		Assert.equal(piecesOf(session.hit("n", SOFT, STARTER, 0)), 0);
		Assert.equal(piecesOf(session.hit("n", SOFT, STARTER, 1)), 0);
		const third = session.hit("n", SOFT, STARTER, 2);
		Assert.equal(third.kind, "chip");
		Assert.equal(piecesOf(third), 1);
		if (third.kind === "chip") {
			Assert.equal(third.taken, 1);
			Assert.equal(third.total, 2);
		}
	}

	@Test
	public brokenOreConfigStillWorks() {
		const zeroHard: OreDef = { ...ORES.copper, hardness: 0, pieces: 3 };
		Assert.equal(piecesOf(new MiningSession<string>().hit("n", zeroHard, STARTER, 0)), 1);
		for (const pieces of [0, -2, 0 / 0, math.huge]) {
			const bad: OreDef = { ...ORES.copper, pieces };
			const result = new MiningSession<string>().hit("n", bad, STARTER, 0);
			Assert.equal(result.kind, "broken", `pieces ${pieces}`);
			Assert.equal(piecesOf(result), 1, `pieces ${pieces}`);
		}
	}

	// ---- node lifecycle ----

	@Test
	public anEmptyBlockRespawns() {
		const session = new MiningSession<string>();
		const ore = ORES.copper;
		const { endedAt } = mineOut(session, "n", ore, STARTER, 0);
		Assert.true(endedAt >= 0);
		Assert.true(session.isDepleted("n", endedAt + ore.respawnSeconds - 0.1));
		Assert.equal(session.hit("n", ore, STARTER, endedAt + 1).kind, "depleted");
		Assert.false(session.isDepleted("n", endedAt + ore.respawnSeconds));
		// A fresh block: full again.
		const again = session.hit("n", ore, STARTER, endedAt + ore.respawnSeconds);
		Assert.equal(again.kind, "chip");
		if (again.kind === "chip") {
			Assert.equal(again.taken, 1);
		}
	}

	@Test
	public nodesAreIndependent() {
		const session = new MiningSession<string>();
		session.hit("a", ORES.copper, STARTER, 0);
		const other = session.hit("b", ORES.copper, STARTER, 1);
		Assert.equal(other.kind, "chip");
		if (other.kind === "chip") {
			Assert.equal(other.taken, 1);
		}
	}

	@Test
	public sessionsArePerPlayer() {
		// Player A emptying a node must not deplete it for player B.
		const a = new MiningSession<string>();
		const b = new MiningSession<string>();
		const { endedAt } = mineOut(a, "n", ORES.copper, TIER2_PICK, 0);
		Assert.true(a.isDepleted("n", endedAt + 0.5));
		Assert.false(b.isDepleted("n", endedAt + 0.5));
		Assert.equal(b.hit("n", ORES.copper, TIER2_PICK, endedAt + 0.5).kind, "chip");
	}

	// ---- anti-cheat: spam and clocks ----

	@Test
	public autoClickerSpamIsCappedBySwingTime() {
		const session = new MiningSession<string>();
		let counted = 0;
		let pieces = 0;
		// 1000 clicks within one second.
		for (let i = 0; i < 1000; i++) {
			const result = session.hit("n", ORES.copper, STARTER, i / 1000);
			if (result.kind !== "cooldown") {
				counted += 1;
				pieces += math.max(piecesOf(result), 0);
			}
		}
		const allowed = math.ceil(1 / (STARTER.swingSeconds * SWING_TOLERANCE));
		Assert.true(counted <= allowed, `counted ${counted}`);
		Assert.true(pieces <= allowed, `pieces ${pieces}`);
	}

	@Test
	public backwardsClockGivesNoFreeHits() {
		const session = new MiningSession<string>();
		session.hit("n", ORES.copper, STARTER, 100);
		Assert.equal(session.hit("n", ORES.copper, STARTER, 50).kind, "cooldown");
	}

	@Test
	public lockedOreDoesNotConsumeTheSwing() {
		// Clicking a locked node by mistake must not delay the next real hit.
		const session = new MiningSession<string>();
		session.hit("q", ORES.iron, STARTER, 0);
		Assert.equal(session.hit("c", ORES.copper, STARTER, 0).kind, "chip");
	}

	@Test
	public swappingToAFastPickaxeRightAfterAHitIsStillOnCooldown() {
		// Regression: a slow pickaxe then a fast one must not give two hits at once.
		const slow = PICKAXES[0];
		const fast = PICKAXES[PICKAXES.size() - 1];
		Assert.true(slow.swingSeconds > fast.swingSeconds);
		const session = new MiningSession<string>();
		Assert.notEqual(session.hit("a", ORES.titanium, fast, 10).kind, "cooldown");
		Assert.equal(session.hit("b", ORES.titanium, fast, 10 + fast.swingSeconds * 0.5).kind, "cooldown");
		Assert.notEqual(session.hit("b", ORES.titanium, fast, 10 + fast.swingSeconds).kind, "cooldown");
	}

	// ---- yield bonus ----

	@Test
	public yieldWithoutBonusIsThePieces() {
		Assert.equal(scaleYield(1, 0, 0), 1);
		Assert.equal(scaleYield(3, 0, 0.99), 3);
	}

	@Test
	public fractionalBonusIsAChance() {
		Assert.equal(scaleYield(1, 0.3, 0.1), 2);
		Assert.equal(scaleYield(1, 0.3, 0.5), 1);
		Assert.equal(scaleYield(1, 1.5, 0.4), 3);
		Assert.equal(scaleYield(1, 1.5, 0.6), 2);
		Assert.equal(scaleYield(2, 0.5, 0.99), 3);
	}

	@Test
	public yieldIgnoresHostileInput() {
		Assert.equal(scaleYield(1, -5, 0), 1);
		Assert.equal(scaleYield(1, 0 / 0, 0), 1);
		// Capped so a data bug can never print infinite ore.
		Assert.equal(scaleYield(1, math.huge, 0.99), 11);
		// No pieces chipped: a bonus never turns an empty hit into ore.
		for (const bad of [0, -1, 0 / 0, math.huge]) {
			Assert.equal(scaleYield(bad, 0.5, 0), 0, `pieces ${bad}`);
		}
	}
}

export = MiningTests;
