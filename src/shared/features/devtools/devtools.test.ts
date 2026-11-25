import { Assert, Test } from "@rbxts/lunit";
import { BAGS } from "shared/config/bags";
import { LAYER_COUNT } from "shared/config/layers";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import { createDefaultProfileData } from "shared/features/profile";
import { MAX_COUNTER } from "shared/lib/repair";
import { DEV_MONEY_AMOUNTS, DEV_ORE_AMOUNT, applyDevCommand, parseDevCommand } from "./devtools";

class DevtoolsTests {
	// ---- parsing: the only input that comes from the client ----

	@Test
	public parsesEveryKnownCommand() {
		Assert.equal(parseDevCommand(["money", DEV_MONEY_AMOUNTS[1]])?.kind, "money");
		Assert.equal(parseDevCommand(["maxGear"])?.kind, "maxGear");
		Assert.equal(parseDevCommand(["openLayers"])?.kind, "openLayers");
		Assert.equal(parseDevCommand(["resetProfile"])?.kind, "resetProfile");
		// No extra arguments are tolerated.
		Assert.undefined(parseDevCommand(["resetProfile", 1]));
	}

	@Test
	public resetBringsBackANewPlayerInPlace() {
		const data = createDefaultProfileData();
		const same = data;
		applyDevCommand(data, { kind: "money", amount: DEV_MONEY_AMOUNTS[2] });
		applyDevCommand(data, { kind: "maxGear" });
		applyDevCommand(data, { kind: "ores" });
		applyDevCommand(data, { kind: "openLayers" });
		data.line.machines.push({ speed: 2, duplicate: 1, quality: 1, capacity: 1, progress: 0, queue: ["copper"] });
		data.stats.totalEarned = 500;
		data.deepestMeters = 80;
		data.inventory.push({ uid: "i1", item: "pet_mole" });
		data.nextUid = 2;
		applyDevCommand(data, { kind: "resetProfile" });
		const fresh = createDefaultProfileData();
		Assert.equal(data, same, "the live table must stay the same object");
		Assert.equal(data.money, 0);
		Assert.equal(data.deepestLayer, 1);
		Assert.equal(data.deepestMeters, 0);
		Assert.equal(data.stats.totalEarned, 0);
		Assert.equal(data.inventory.size(), 0);
		Assert.equal(data.nextUid, 1);
		Assert.deepEqual(data.gear, fresh.gear);
		Assert.deepEqual(data.bag, {});
		Assert.deepEqual(data.line, fresh.line);
	}

	@Test
	public resetKeepsTheVersionAndGrantedReceipts() {
		const data = createDefaultProfileData();
		data.purchaseIds.push("receipt-1");
		applyDevCommand(data, { kind: "resetProfile" });
		// A paid purchase must never be granted twice, so its id survives a test reset.
		Assert.deepEqual(data.purchaseIds, ["receipt-1"]);
		Assert.equal(data.schemaVersion, createDefaultProfileData().schemaVersion);
	}

	@Test
	public resetGivesIndependentTablesNotSharedOnes() {
		const data = createDefaultProfileData();
		applyDevCommand(data, { kind: "resetProfile" });
		data.bag.titanium = 5;
		Assert.undefined(createDefaultProfileData().bag.titanium);
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
	public maxGearOwnsEverythingAndWearsTheBest() {
		const data = createDefaultProfileData();
		applyDevCommand(data, { kind: "maxGear" });
		Assert.equal(data.gear.equipped.pickaxe, PICKAXES[PICKAXES.size() - 1].id);
		Assert.equal(data.gear.equipped.bag, BAGS[BAGS.size() - 1].id);
		Assert.equal(data.gear.equipped.shoes, SHOES[SHOES.size() - 1].id);
		const all = PICKAXES.size() + BAGS.size() + SHOES.size();
		Assert.equal(data.gear.owned.size(), all);
		// A second press adds no duplicates.
		applyDevCommand(data, { kind: "maxGear" });
		Assert.equal(data.gear.owned.size(), all);
		Assert.equal(data.money, 0);
	}

	@Test
	public oresFillTheBagWithEveryOre() {
		const data = createDefaultProfileData();
		Assert.equal(parseDevCommand(["ores"])?.kind, "ores");
		Assert.undefined(parseDevCommand(["ores", 99]));
		Assert.undefined(parseDevCommand(["materials"]));
		applyDevCommand(data, { kind: "ores" });
		Assert.equal(data.bag.copper, DEV_ORE_AMOUNT);
		Assert.equal(data.bag.etherium, DEV_ORE_AMOUNT);
		// A second press adds again (it is a top-up button), never above the counter cap.
		applyDevCommand(data, { kind: "ores" });
		Assert.equal(data.bag.titanium, DEV_ORE_AMOUNT * 2);
		data.bag.titanium = MAX_COUNTER;
		applyDevCommand(data, { kind: "ores" });
		Assert.equal(data.bag.titanium, MAX_COUNTER);
	}

	@Test
	public openLayersReachesTheDeepest() {
		const data = createDefaultProfileData();
		applyDevCommand(data, { kind: "openLayers" });
		Assert.equal(data.deepestLayer, LAYER_COUNT);
	}
}

export = DevtoolsTests;
