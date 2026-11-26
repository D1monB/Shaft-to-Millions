import { Assert, Test } from "@rbxts/lunit";
import { ORES } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { MiningSession } from "./mining";
import { CRIT_MULTIPLIER } from "./tuning";

const PICK = PICKAXES[0];
const ORE = ORES.copper;

function damageAfterOneHit(multiplier: number): number {
	const session = new MiningSession<string>();
	const result = session.hit("node", ORE, PICK, 100, multiplier);
	return result.kind === "progress" ? result.damage : result.kind === "broken" ? ORE.hardness : -1;
}

class CritTests {
	@Test
	public aCritDealsMoreDamage() {
		Assert.equal(damageAfterOneHit(1), PICK.power);
		Assert.equal(damageAfterOneHit(CRIT_MULTIPLIER), math.min(PICK.power * CRIT_MULTIPLIER, ORE.hardness));
	}

	@Test
	public badMultipliersCountAsOne() {
		for (const bad of [0, -3, 0.5, 0 / 0, math.huge]) {
			Assert.equal(damageAfterOneHit(bad), PICK.power, `multiplier ${bad}`);
		}
	}
}

export = CritTests;
