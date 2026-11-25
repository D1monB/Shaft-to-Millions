import { Assert, Test } from "@rbxts/lunit";
import { GoalCandidate, pickGoal } from "./goals";

const PICK: GoalCandidate = { label: "Сталева кирка", price: 250, priority: 0 };
const BAG: GoalCandidate = { label: "Шкіряна сумка", price: 150, priority: 1 };

class GoalsTests {
	@Test
	public fullBagComesFirst() {
		const text = pickGoal({ money: 1000, bagUsed: 25, bagCapacity: 25 }, [PICK, BAG]);
		Assert.true(text.find("Сумка повна")[0] !== undefined);
	}

	@Test
	public affordablePrefersPriority() {
		// Both affordable: the pickaxe unlocks new ore, so it wins although it is pricier.
		const text = pickGoal({ money: 1000, bagUsed: 0, bagCapacity: 25 }, [BAG, PICK]);
		Assert.true(text.find("Сталева кирка")[0] !== undefined);
	}

	@Test
	public otherwiseShowsCheapestWithMissingAmount() {
		const text = pickGoal({ money: 100, bagUsed: 3, bagCapacity: 25 }, [PICK, BAG]);
		Assert.true(text.find("Шкіряна сумка")[0] !== undefined);
		Assert.true(text.find("50")[0] !== undefined);
	}

	@Test
	public firstFurnaceBeatsABagAndTiesWithAPickaxeByPrice() {
		const furnace: GoalCandidate = { label: "Горн", price: 500, priority: 0 };
		// Furnace (priority 0) beats the bag (priority 1) even when the bag is cheaper.
		const overBag = pickGoal({ money: 1000, bagUsed: 0, bagCapacity: 25 }, [BAG, furnace]);
		Assert.true(overBag.find("Горн")[0] !== undefined);
		// Same priority as an ore-unlocking pickaxe: the pricier one is shown, so the player is not stuck on a cheap one.
		const overPickaxe = pickGoal({ money: 1000, bagUsed: 0, bagCapacity: 25 }, [PICK, furnace]);
		Assert.true(overPickaxe.find("Горн")[0] !== undefined);
	}

	@Test
	public noGoalsLeft() {
		Assert.true(pickGoal({ money: 0, bagUsed: 0, bagCapacity: 25 }, []).find("Клікай")[0] !== undefined);
		Assert.true(pickGoal({ money: 0, bagUsed: 5, bagCapacity: 25 }, []).find("глибше")[0] !== undefined);
	}

	@Test
	public badPricesAreIgnored() {
		const broken: GoalCandidate = { label: "Bug", price: 0 / 0, priority: -1 };
		const text = pickGoal({ money: 0, bagUsed: 1, bagCapacity: 25 }, [broken, BAG]);
		Assert.true(text.find("Bug")[0] === undefined);
		Assert.true(text.find("Шкіряна сумка")[0] !== undefined);
	}

	@Test
	public negativeMoneyDoesNotInflateMissingAmount() {
		const text = pickGoal({ money: -500, bagUsed: 1, bagCapacity: 25 }, [BAG]);
		Assert.true(text.find("150")[0] !== undefined);
	}
}

export = GoalsTests;
