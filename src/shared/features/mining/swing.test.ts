import { Assert, Test } from "@rbxts/lunit";
import { ORES } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { MiningSession } from "./mining";

// Regression (decision 065): a crystal cluster and ore share one swing cooldown.
class SwingTests {
	@Test
	public alternatingClusterAndOreNeverSwingsFaster() {
		const session = new MiningSession<string>();
		const pickaxe = PICKAXES[0];
		Assert.true(session.trySwing(pickaxe, 10));
		Assert.equal(session.hit("n", ORES.copper, pickaxe, 10.1).kind, "cooldown");
		Assert.notEqual(session.hit("n", ORES.copper, pickaxe, 11).kind, "cooldown");
		Assert.false(session.trySwing(pickaxe, 11.1));
		Assert.false(session.trySwing(pickaxe, 0));
		Assert.true(session.trySwing(pickaxe, 12));
	}
}

export = SwingTests;
