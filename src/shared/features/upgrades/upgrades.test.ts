import { Assert, Test } from "@rbxts/lunit";
import { BAGS } from "shared/config/bags";
import { PICKAXES } from "shared/config/pickaxes";
import { RESOURCES, ResourceId } from "shared/config/resources";
import { SHOES } from "shared/config/shoes";
import {
	GEAR_BY_SLOT,
	GEAR_SLOTS,
	GearState,
	MaterialStock,
	applyPurchase,
	createStarterGear,
	findGear,
	gearCardState,
	isGearSlot,
	materialList,
	missingMaterials,
	nextGearToBuy,
	tryBuyGear,
	tryEquipGear,
} from "./upgrades";

const STONE = PICKAXES[1]; // money only
const COPPER = PICKAXES[2]; // money + copper ingots

function apply(id: string, money: number, stock: MaterialStock, gear: GearState): number {
	const result = tryBuyGear(id, money, stock, gear);
	if (!result.ok) {
		return money;
	}
	applyPurchase(result, stock, gear);
	return result.money;
}

class UpgradesTests {
	@Test
	public everyItemIdIsUniqueAndEveryMaterialExists() {
		const seen = new Set<string>();
		for (const slot of GEAR_SLOTS) {
			for (const def of GEAR_BY_SLOT[slot]) {
				Assert.false(seen.has(def.id));
				seen.add(def.id);
				Assert.true(def.price >= 0 && def.price < math.huge);
				for (const [id, amount] of pairs(def.materials)) {
					Assert.notUndefined(RESOURCES[id as ResourceId]);
					Assert.true(amount > 0 && math.floor(amount) === amount);
				}
			}
		}
	}

	@Test
	public startersAreFreeAndNeedNoMaterials() {
		for (const slot of GEAR_SLOTS) {
			const starter = GEAR_BY_SLOT[slot][0];
			Assert.equal(starter.price, 0);
			Assert.equal(materialList(starter.materials).size(), 0);
			Assert.equal(starter.special, undefined);
		}
		const gear = createStarterGear();
		Assert.equal(gear.owned.size(), 3);
		Assert.equal(gear.equipped.pickaxe, PICKAXES[0].id);
	}

	@Test
	public mainLinesGetStrongerAndPricier() {
		const pickaxes = PICKAXES.filter((def) => def.special === undefined);
		for (let i = 1; i < pickaxes.size(); i++) {
			Assert.true(pickaxes[i].price > pickaxes[i - 1].price);
			Assert.true(pickaxes[i].tier >= pickaxes[i - 1].tier);
			Assert.true(
				pickaxes[i].power / pickaxes[i].swingSeconds > pickaxes[i - 1].power / pickaxes[i - 1].swingSeconds,
			);
		}
		for (let i = 1; i < BAGS.size(); i++) {
			Assert.true(BAGS[i].capacity > BAGS[i - 1].capacity && BAGS[i].price > BAGS[i - 1].price);
		}
		for (let i = 1; i < SHOES.size(); i++) {
			Assert.true(SHOES[i].walkSpeed > SHOES[i - 1].walkSpeed && SHOES[i].price > SHOES[i - 1].price);
		}
	}

	@Test
	public buysForMoneyAndEquips() {
		const gear = createStarterGear();
		const money = apply(STONE.id, 1000, {}, gear);
		Assert.equal(money, 1000 - STONE.price);
		Assert.true(gear.owned.includes(STONE.id));
		Assert.equal(gear.equipped.pickaxe, STONE.id);
	}

	@Test
	public materialsAreTakenFromTheStock() {
		const gear = createStarterGear();
		const stock: MaterialStock = { copper_ingot: 7, coal: 3 };
		apply(COPPER.id, 1000, stock, gear);
		Assert.equal(stock.copper_ingot, 7 - (COPPER.materials.copper_ingot ?? 0));
		Assert.equal(stock.coal, 3);
		// Spending the last piece removes the key, like everywhere else in the warehouse.
		const exact: MaterialStock = { copper_ingot: COPPER.materials.copper_ingot };
		apply(COPPER.id, 1000, exact, createStarterGear());
		Assert.undefined(exact.copper_ingot);
	}

	@Test
	public refusesWithoutMoneyOrMaterials() {
		const gear = createStarterGear();
		const poor = tryBuyGear(STONE.id, STONE.price - 1, {}, gear);
		Assert.true(!poor.ok && poor.reason === "not-enough-money");
		const noIngots = tryBuyGear(COPPER.id, 1_000_000, { copper_ingot: 1 }, gear);
		Assert.true(!noIngots.ok && noIngots.reason === "not-enough-materials");
		Assert.equal(gear.owned.size(), 3);
	}

	@Test
	public exactMoneyAndMaterialsAreEnough() {
		const stock: MaterialStock = { copper_ingot: COPPER.materials.copper_ingot };
		Assert.true(tryBuyGear(COPPER.id, COPPER.price, stock, createStarterGear()).ok);
	}

	@Test
	public secondPurchaseOfTheSameItemIsRefused() {
		const gear = createStarterGear();
		const money = apply(STONE.id, 1000, {}, gear);
		const again = tryBuyGear(STONE.id, money, {}, gear);
		Assert.true(!again.ok && again.reason === "owned");
		Assert.true(!tryBuyGear(PICKAXES[0].id, 1000, {}, gear).ok);
	}

	@Test
	public badIdsAndBrokenNumbersAreRefused() {
		const gear = createStarterGear();
		for (const id of [undefined, 5, "", "pickaxe_unknown", "money", {}] as unknown[]) {
			const result = tryBuyGear(id, 1_000_000, {}, gear);
			Assert.true(!result.ok && result.reason === "unknown");
			Assert.undefined(findGear(id));
		}
		Assert.false(tryBuyGear(STONE.id, 0 / 0, {}, gear).ok);
		Assert.false(tryBuyGear(STONE.id, -math.huge, {}, gear).ok);
		// NaN or negative stock never counts as having materials.
		Assert.false(tryBuyGear(COPPER.id, 1000, { copper_ingot: 0 / 0 }, gear).ok);
		Assert.false(tryBuyGear(COPPER.id, 1000, { copper_ingot: -50 }, gear).ok);
	}

	@Test
	public missingMaterialsListsWhatIsShort() {
		const missing = missingMaterials(COPPER, { copper_ingot: 2 });
		Assert.equal(missing.size(), 1);
		Assert.equal(missing[0].id, "copper_ingot");
		Assert.equal(missing[0].have, 2);
		Assert.equal(missingMaterials(STONE, {}).size(), 0);
	}

	@Test
	public equipsOnlyOwnedItemsOfTheRightSlot() {
		const gear = createStarterGear();
		const notOwned = tryEquipGear(STONE.id, gear);
		Assert.true(!notOwned.ok && notOwned.reason === "not-owned");
		apply(STONE.id, 1000, {}, gear);
		const already = tryEquipGear(STONE.id, gear);
		Assert.true(!already.ok && already.reason === "already");
		const back = tryEquipGear(PICKAXES[0].id, gear);
		Assert.true(back.ok && back.slot === "pickaxe");
		const bag = tryEquipGear(BAGS[0].id, gear);
		Assert.true(!bag.ok && bag.reason === "already");
		Assert.false(tryEquipGear("nope", gear).ok);
		Assert.false(tryEquipGear(7, gear).ok);
	}

	@Test
	public cardStates() {
		const gear = createStarterGear();
		Assert.equal(gearCardState(PICKAXES[0].id, gear), "equipped");
		Assert.equal(gearCardState(STONE.id, gear), "for-sale");
		apply(STONE.id, 1000, {}, gear);
		Assert.equal(gearCardState(PICKAXES[0].id, gear), "owned");
		Assert.equal(gearCardState(STONE.id, gear), "equipped");
	}

	@Test
	public nextGoalSkipsSideItemsAndOwnedOnes() {
		const gear = createStarterGear();
		Assert.equal(nextGearToBuy("pickaxe", gear)?.id, STONE.id);
		gear.owned.push(STONE.id, COPPER.id, PICKAXES[3].id);
		const upcoming = nextGearToBuy("pickaxe", gear);
		Assert.notUndefined(upcoming);
		Assert.equal(upcoming?.special, undefined);
		for (const def of PICKAXES) {
			gear.owned.push(def.id);
		}
		Assert.undefined(nextGearToBuy("pickaxe", gear));
	}

	@Test
	public slotGuard() {
		Assert.true(isGearSlot("pickaxe"));
		Assert.true(isGearSlot("shoes"));
		Assert.false(isGearSlot("warehouse"));
		Assert.false(isGearSlot(3));
	}
}

export = UpgradesTests;
