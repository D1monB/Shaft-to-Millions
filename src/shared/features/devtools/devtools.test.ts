import { Assert, Test } from "@rbxts/lunit";
import { BAGS } from "shared/config/bags";
import { LAYER_COUNT } from "shared/config/layers";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import { createDefaultProfileData } from "shared/features/profile";
import { MAX_COUNTER } from "shared/lib/repair";
import { DEV_MONEY_AMOUNTS, applyDevCommand, parseDevCommand } from "./devtools";

class DevtoolsTests {
	// ---- parsing: the only input that comes from the client ----

	@Test
	public parsesEveryKnownCommand() {
		Assert.equal(parseDevCommand(["money", DEV_MONEY_AMOUNTS[1]])?.kind, "money");
		Assert.equal(parseDevCommand(["maxGear"])?.kind, "maxGear");
		Assert.equal(parseDevCommand(["openLayers"])?.kind, "openLayers");
	}

	@Test
	public onlyPresetAmountsAreAccepted() {
		// An arbitrary number would let a modified client request any sum, even in Studio test servers.
		for (const amount of [0, -1000, 999, 1_000_000_000, 0 / 0, math.huge, "1000", undefined]) {
			Assert.undefined(parseDevCommand(["money", amount]), `amount ${amount}`);
		}
	}

	@Test
	public rejectsWrongShapes() {
		Assert.undefined(parseDevCommand([]));
		Assert.undefined(parseDevCommand(["money"]));
		Assert.undefined(parseDevCommand(["money", 1000, "extra"]));
		Assert.undefined(parseDevCommand(["maxGear", 1]));
		Assert.undefined(parseDevCommand(["openLayers", "x"]));
		Assert.undefined(parseDevCommand(["giveEverything"]));
		Assert.undefined(parseDevCommand([5]));
	}

	// ---- applying ----

	@Test
	public moneyAddsButIsNotCountedAsEarned() {
		const data = createDefaultProfileData();
		applyDevCommand(data, { kind: "money", amount: 100_000 });
		Assert.equal(data.money, 100_000);
		Assert.equal(data.stats.totalEarned, 0);
	}

	@Test
	public moneyNeverExceedsTheCap() {
		const data = createDefaultProfileData();
		data.money = MAX_COUNTER - 5;
		applyDevCommand(data, { kind: "money", amount: 10_000_000 });
		Assert.equal(data.money, MAX_COUNTER);
	}

	@Test
	public maxGearSetsTheTopLevelOfEveryTrack() {
		const data = createDefaultProfileData();
		applyDevCommand(data, { kind: "maxGear" });
		Assert.equal(data.levels.pickaxe, PICKAXES.size());
		Assert.equal(data.levels.bag, BAGS.size());
		Assert.equal(data.levels.shoes, SHOES.size());
		Assert.equal(data.money, 0);
	}

	@Test
	public openLayersReachesTheDeepest() {
		const data = createDefaultProfileData();
		applyDevCommand(data, { kind: "openLayers" });
		Assert.equal(data.deepestLayer, LAYER_COUNT);
	}
}

export = DevtoolsTests;
