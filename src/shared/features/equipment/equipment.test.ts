import { Assert, Test } from "@rbxts/lunit";
import { CHESTS, CHEST_IDS } from "shared/config/chests";
import { ITEMS } from "shared/config/items";
import { MAX_WALK_SPEED, SHOES } from "shared/config/shoes";
import type { OwnedItem } from "shared/features/chests";
import { chestOdds } from "shared/features/chests";
import { walkSpeedFor } from "shared/features/movement";
import { MAX_SELL_MULTIPLIER } from "shared/features/selling";
import {
	BONUS_CAPS,
	MAX_PETS,
	bestLoadout,
	computeBonuses,
	equipItem,
	isEquipped,
	itemSellValue,
	newEquipped,
	sellItem,
	unequipItem,
} from "./equipment";

function inv(...items: Array<keyof typeof ITEMS>): OwnedItem[] {
	return items.map((item, index) => ({ uid: `i${index + 1}`, item }));
}

class EquipmentTests {
	// ---- equipping ----

	@Test
	public aurasReplaceEachOther() {
		const inventory = inv("aura_breeze", "aura_storm");
		const equipped = newEquipped();
		Assert.true(equipItem(inventory, equipped, "i1").ok);
		Assert.true(equipItem(inventory, equipped, "i2").ok);
		Assert.equal(equipped.speedAura, "i2");
	}

	@Test
	public petsUseLimitedSlots() {
		const inventory = inv("pet_mole", "pet_mole", "pet_mole", "pet_mole");
		const equipped = newEquipped();
		for (const uid of ["i1", "i2", "i3"]) {
			Assert.true(equipItem(inventory, equipped, uid).ok);
		}
		const fourth = equipItem(inventory, equipped, "i4");
		Assert.false(fourth.ok);
		Assert.equal(equipped.pets.size(), MAX_PETS);
	}

	@Test
	public equippingTheSamePetTwiceUsesOneSlot() {
		const inventory = inv("pet_golem");
		const equipped = newEquipped();
		equipItem(inventory, equipped, "i1");
		equipItem(inventory, equipped, "i1");
		Assert.equal(equipped.pets.size(), 1);
	}

	@Test
	public cannotEquipWhatYouDoNotOwn() {
		const equipped = newEquipped();
		Assert.false(equipItem(inv("pet_mole"), equipped, "i99").ok);
		Assert.false(isEquipped(equipped, "i99"));
	}

	@Test
	public unequipFreesTheSlot() {
		const inventory = inv("pet_mole", "paura_core");
		const equipped = newEquipped();
		equipItem(inventory, equipped, "i1");
		equipItem(inventory, equipped, "i2");
		Assert.true(unequipItem(equipped, "i1"));
		Assert.true(unequipItem(equipped, "i2"));
		Assert.false(unequipItem(equipped, "i2"));
		Assert.equal(equipped.pets.size(), 0);
		Assert.undefined(equipped.pickaxeAura);
	}

	// ---- combined bonuses ----

	@Test
	public petBonusesAdd() {
		const inventory = inv("pet_mole", "pet_beetle");
		const equipped = { pets: ["i1", "i2"] };
		const bonuses = computeBonuses(inventory, equipped);
		Assert.true(math.abs(bonuses.petBonus - 0.15) < 1e-9);
		Assert.true(math.abs(bonuses.sellMultiplier - 1.15) < 1e-9);
		Assert.false(bonuses.petCapped);
	}

	@Test
	public petBonusIsCapped() {
		const inventory = inv("pet_golem", "pet_golem", "pet_golem");
		const bonuses = computeBonuses(inventory, { pets: ["i1", "i2", "i3"] });
		Assert.equal(bonuses.petBonus, BONUS_CAPS.pets);
		Assert.true(bonuses.sellMultiplier <= MAX_SELL_MULTIPLIER);
	}

	@Test
	public hackedEquipListsDoNotStack() {
		// A corrupted save lists the same golem 10 times, plus an aura in the pet list.
		const inventory = inv("pet_golem", "aura_storm");
		const pets: string[] = [];
		for (let i = 0; i < 10; i++) {
			pets.push("i1");
		}
		pets.push("i2");
		const bonuses = computeBonuses(inventory, { pets, speedAura: "i1" });
		Assert.equal(bonuses.petBonus, ITEMS.pet_golem.bonus);
		// A pet in the aura slot gives no speed.
		Assert.equal(bonuses.speedBonus, 0);
	}

	@Test
	public staleUidsCountForNothing() {
		const bonuses = computeBonuses([], { pets: ["i1"], speedAura: "i2", pickaxeAura: "i3" });
		Assert.equal(bonuses.sellMultiplier, 1);
		Assert.equal(bonuses.speedBonus, 0);
		Assert.equal(bonuses.yieldBonus, 0);
	}

	@Test
	public bestPossibleLoadoutStaysWithinTheCaps() {
		// Balance guard: the strongest gear must stay inside every hard cap of the game.
		const inventory = inv("pet_golem", "pet_golem", "pet_golem", "aura_storm", "paura_core");
		const bonuses = computeBonuses(inventory, bestLoadout(inventory));
		Assert.true(bonuses.sellMultiplier <= MAX_SELL_MULTIPLIER);
		Assert.true(bonuses.yieldBonus <= BONUS_CAPS.yield);
		Assert.true(walkSpeedFor(SHOES.size(), bonuses.speedBonus) <= MAX_WALK_SPEED);
	}

	@Test
	public bestLoadoutPicksTheStrongest() {
		const inventory = inv("pet_mole", "pet_golem", "pet_moth", "pet_beetle", "aura_breeze", "aura_comet");
		const best = bestLoadout(inventory);
		Assert.equal(best.pets.size(), MAX_PETS);
		Assert.true(best.pets.includes("i2"));
		Assert.false(best.pets.includes("i1"));
		Assert.equal(best.speedAura, "i6");
	}

	// ---- selling items ----

	@Test
	public sellingRemovesAndUnequips() {
		const inventory = inv("pet_moth");
		const equipped = newEquipped();
		equipItem(inventory, equipped, "i1");
		Assert.equal(sellItem(inventory, equipped, "i1"), itemSellValue("pet_moth"));
		Assert.equal(inventory.size(), 0);
		Assert.equal(equipped.pets.size(), 0);
		Assert.equal(sellItem(inventory, equipped, "i1"), 0);
	}

	@Test
	public resellingNeverPaysForAChest() {
		// Expected resale value of one chest must be far below its price, or chests become a money printer.
		for (const chestId of CHEST_IDS) {
			let expected = 0;
			for (const line of chestOdds(chestId)) {
				expected += line.chance * itemSellValue(line.item);
			}
			Assert.true(expected < CHESTS[chestId].dollarPrice * 0.5, `${chestId}: ${expected}`);
		}
	}
}

export = EquipmentTests;
