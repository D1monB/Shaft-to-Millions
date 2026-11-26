import { Assert, Test } from "@rbxts/lunit";
import {
	AURA_ROLL_TABLE,
	FREE_SPIN_SECONDS,
	MAX_FREE_SPINS,
	PITY_SPINS,
	SPIN_CRYSTAL_PRICE,
} from "shared/config/aura-roll";
import { INVENTORY_LIMIT, ITEMS } from "shared/config/items";
import { sellDuplicates } from "shared/features/equipment";
import { canSpin, newAuraRollState, refreshSpins, rollOdds, secondsToNextSpin, spin } from "./aura-roll";

const NOW = 1_000_000;

function isEpic(item: keyof typeof ITEMS): boolean {
	return ITEMS[item].rarity === "epic" || ITEMS[item].rarity === "legendary";
}

class AuraRollTests {
	@Test
	public tableHasOnlyAurasAndOddsSumToOne() {
		let total = 0;
		for (const line of rollOdds()) {
			total += line.chance;
			Assert.true(ITEMS[line.item].kind !== "pet", line.item);
		}
		Assert.true(math.abs(total - 1) < 1e-9);
		Assert.true(AURA_ROLL_TABLE.every((entry) => entry.weight > 0));
	}

	@Test
	public freeSpinsComeBackOverTimeUpToTheCap() {
		const state = newAuraRollState();
		state.spins = 0;
		refreshSpins(state, NOW);
		Assert.equal(state.spins, 0);
		refreshSpins(state, NOW + FREE_SPIN_SECONDS - 1);
		Assert.equal(state.spins, 0);
		refreshSpins(state, NOW + FREE_SPIN_SECONDS);
		Assert.equal(state.spins, 1);
		refreshSpins(state, NOW + FREE_SPIN_SECONDS * 100);
		Assert.equal(state.spins, MAX_FREE_SPINS);
		Assert.equal(secondsToNextSpin(state, NOW), 0);
	}

	@Test
	public brokenClocksGiveNothing() {
		const state = newAuraRollState();
		state.spins = 0;
		refreshSpins(state, NOW);
		for (const bad of [0 / 0, -5, 0, math.huge]) {
			refreshSpins(state, bad);
		}
		// A clock that jumped back restarts the timer instead of granting spins.
		refreshSpins(state, NOW - 5000);
		Assert.equal(state.spins, 0);
	}

	@Test
	public spinChecksPaymentAndRoom() {
		const state = newAuraRollState();
		Assert.true(canSpin(state, "free", 0, 0).ok);
		state.spins = 0;
		Assert.false(canSpin(state, "free", 1000, 0).ok);
		Assert.false(canSpin(state, "crystals", SPIN_CRYSTAL_PRICE - 1, 0).ok);
		Assert.false(canSpin(state, "crystals", 0 / 0, 0).ok);
		Assert.true(canSpin(state, "crystals", SPIN_CRYSTAL_PRICE, 0).ok);
		const full = canSpin(state, "crystals", 1e6, INVENTORY_LIMIT);
		Assert.true(!full.ok && full.reason === "inventory-full");
	}

	@Test
	public pityGuaranteesAnEpicWithinTheLimit() {
		const state = newAuraRollState();
		let sinceEpic = 0;
		for (let i = 0; i < 200; i++) {
			// Roll 0 always lands on the first (common) entry unless the guarantee kicks in.
			const item = spin(state, 0);
			sinceEpic = isEpic(item) ? 0 : sinceEpic + 1;
			Assert.true(sinceEpic < PITY_SPINS, `spin ${i}`);
		}
	}

	@Test
	public badRollsNeverFavourRareAuras() {
		for (const bad of [0 / 0, -1, -math.huge]) {
			Assert.false(isEpic(spin(newAuraRollState(), bad)), `roll ${bad}`);
		}
		Assert.true(ITEMS[spin(newAuraRollState(), math.huge)] !== undefined);
	}

	@Test
	public sellingDuplicatesKeepsOneCopyAndEverythingEquipped() {
		const inventory = [
			{ uid: "i1", item: "aura_breeze" as const },
			{ uid: "i2", item: "aura_breeze" as const },
			{ uid: "i3", item: "aura_breeze" as const },
			{ uid: "i4", item: "pet_mole" as const },
			{ uid: "i5", item: "pet_mole" as const },
		];
		const equipped = { speedAura: "i3", pets: ["i4", "i5"] };
		const sold = sellDuplicates(inventory, equipped);
		Assert.equal(sold.count, 2);
		Assert.true(sold.money > 0);
		Assert.equal(inventory.size(), 3);
		Assert.true(inventory.some((owned) => owned.uid === "i3"));
		Assert.equal(sellDuplicates(inventory, equipped).count, 0);
	}
}

export = AuraRollTests;
