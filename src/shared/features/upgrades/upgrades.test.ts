import { Assert, Test } from "@rbxts/lunit";
import { BAGS } from "shared/config/bags";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import {
	GEAR_BY_SLOT,
	GEAR_SLOTS,
	GearState,
	applyPurchase,
	createStarterGear,
	findGear,
	gearCardState,
	isGearSlot,
	nextGearToBuy,
	tryBuyGear,
	tryEquipGear,
} from "./upgrades";

const STONE = PICKAXES[1];
const COPPER = PICKAXES[2];

function apply(id: string, money: number, gear: GearState): number {
	const result = tryBuyGear(id, money, gear);
	if (!result.ok) {
		return money;
	}
	applyPurchase(result, gear);
	return result.money;
}

class UpgradesTests {
	@Test
	public everyItemIdIsUniqueAndHasAPrice() {
		const seen = new Set<string>();
		for (const slot of GEAR_SLOTS) {
			for (const def of GEAR_BY_SLOT[slot]) {
				Assert.false(seen.has(def.id));
				seen.add(def.id);
				Assert.true(def.price >= 0 && def.price < math.huge && math.floor(def.price) === def.price);
			}
		}
	}

	@Test
	public startersAreFree() {
		for (const slot of GEAR_SLOTS) {
			const starter = GEAR_BY_SLOT[slot][0];
			Assert.equal(starter.price, 0);
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
	public everyOreTierHasAPickaxe() {
		// Every ore must be minable by some pickaxe on sale, or a whole floor is a dead end.
		for (const id of ORE_IDS) {
			Assert.true(
				PICKAXES.some((def) => def.tier >= ORES[id].requiredTier),
				`no pickaxe mines ${id}`,
			);
		}
	}

	@Test
	public buysForMoneyAndEquips() {
		const gear = createStarterGear();
		const money = apply(STONE.id, 1000, gear);
		Assert.equal(money, 1000 - STONE.price);
		Assert.true(gear.owned.includes(STONE.id));
		Assert.equal(gear.equipped.pickaxe, STONE.id);
	}

	@Test
	public refusesWithoutMoney() {
		const gear = createStarterGear();
		const poor = tryBuyGear(STONE.id, STONE.price - 1, gear);
		Assert.true(!poor.ok && poor.reason === "not-enough-money");
		Assert.equal(gear.owned.size(), 3);
	}

	@Test
	public exactMoneyIsEnough() {
		Assert.true(tryBuyGear(COPPER.id, COPPER.price, createStarterGear()).ok);
		Assert.equal(0, apply(COPPER.id, COPPER.price, createStarterGear()));
	}

	@Test
	public secondPurchaseOfTheSameItemIsRefused() {
		const gear = createStarterGear();
		const money = apply(STONE.id, 1000, gear);
		const again = tryBuyGear(STONE.id, money, gear);
		Assert.true(!again.ok && again.reason === "owned");
		Assert.true(!tryBuyGear(PICKAXES[0].id, 1000, gear).ok);
	}

	@Test
	public badIdsAndBrokenNumbersAreRefused() {
		const gear = createStarterGear();
		for (const id of [undefined, 5, "", "pickaxe_unknown", "money", {}] as unknown[]) {
			const result = tryBuyGear(id, 1_000_000, gear);
			Assert.true(!result.ok && result.reason === "unknown");
			Assert.undefined(findGear(id));
		}
		Assert.false(tryBuyGear(STONE.id, 0 / 0, gear).ok);
		Assert.false(tryBuyGear(STONE.id, -math.huge, gear).ok);
	}

	@Test
	public equipsOnlyOwnedItemsOfTheRightSlot() {
		const gear = createStarterGear();
		const notOwned = tryEquipGear(STONE.id, gear);
		Assert.true(!notOwned.ok && notOwned.reason === "not-owned");
		apply(STONE.id, 1000, gear);
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
		apply(STONE.id, 1000, gear);
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
	public hintPrefersACheaperSidePickaxeThatOpensNewOre() {
		const gear = createStarterGear();
		for (const def of PICKAXES) {
			if (def.tier <= 3) {
				gear.owned.push(def.id);
			}
		}
		// The hammer (tier 4, side item) is cheaper than the titanium pickaxe (tier 4, main line).
		const hammer = PICKAXES.find((def) => def.id === "pickaxe_hammer");
		const mainLine = nextGearToBuy("pickaxe", gear);
		Assert.true((hammer?.price ?? math.huge) < (mainLine?.price ?? 0));
		Assert.equal(nextGearToBuy("pickaxe", gear, 3)?.id, "pickaxe_hammer");
		gear.owned.push("pickaxe_hammer");
		Assert.equal(nextGearToBuy("pickaxe", gear, 4)?.id, mainLine?.id);
	}

	@Test
	public hintWithoutTierKeepsTheOldBehaviour() {
		const gear = createStarterGear();
		Assert.equal(nextGearToBuy("pickaxe", gear)?.id, STONE.id);
		Assert.equal(nextGearToBuy("pickaxe", gear, 1)?.id, STONE.id);
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
