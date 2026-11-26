import { Assert, Test } from "@rbxts/lunit";
import { ORES } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { MiningSession } from "./mining";
import { CRIT_MULTIPLIER } from "./tuning";

const PICK = PICKAXES[0];
const ORE = ORES.copper;

function piecesFromOneHit(multiplier: number): number {
	const session = new MiningSession<string>();
	const result = session.hit("node", ORE, PICK, 100, multiplier);
	return result.kind === "chip" || result.kind === "broken" ? result.pieces : -1;
}

class CritTests {
	@Test
	public aCritChipsMorePieces() {
		const normal = math.floor(PICK.power / ORE.hardness);
		Assert.equal(piecesFromOneHit(1), normal);
		Assert.equal(
			piecesFromOneHit(CRIT_MULTIPLIER),
			math.min(math.floor((PICK.power * CRIT_MULTIPLIER) / ORE.hardness), ORE.pieces),
		);
		Assert.true(piecesFromOneHit(CRIT_MULTIPLIER) > normal);
	}

	@Test
	public badMultipliersCountAsOne() {
		for (const bad of [0, -3, 0.5, 0 / 0, math.huge]) {
			Assert.equal(piecesFromOneHit(bad), math.floor(PICK.power / ORE.hardness), `multiplier ${bad}`);
		}
	}
}

export = CritTests;
