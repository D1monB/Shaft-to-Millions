import { Assert, Test } from "@rbxts/lunit";
import { CHESTS, CHEST_IDS } from "shared/config/chests";
import { INVENTORY_HARD_LIMIT, INVENTORY_LIMIT, ITEMS } from "shared/config/items";
import {
	MAX_REMEMBERED_PURCHASES,
	OwnedItem,
	addItem,
	canOpenWithDollars,
	chestOdds,
	rememberPurchase,
	removeItem,
	rollChest,
	wasGranted,
} from "./chests";

class ChestsTests {
	// ---- reward tables ----

	@Test
	public eachChestHasItsOwnKindOfReward() {
		const kinds = { pet_chest: "pet", speed_chest: "speedAura", pickaxe_chest: "pickaxeAura" } as const;
		for (const chestId of CHEST_IDS) {
			for (const entry of CHESTS[chestId].rewards) {
				Assert.equal(ITEMS[entry.item].kind, kinds[chestId], `${entry.item} in ${chestId}`);
				Assert.true(entry.weight > 0);
			}
		}
	}

	@Test
	public oddsAddUpToExactlyOne() {
		for (const chestId of CHEST_IDS) {
			let sum = 0;
			for (const line of chestOdds(chestId)) {
				Assert.true(line.chance > 0 && line.chance < 1);
				sum += line.chance;
			}
			Assert.true(math.abs(sum - 1) < 1e-9, `${chestId} odds sum ${sum}`);
		}
	}

	@Test
	public rarerItemsAreLessLikelyAndBetter() {
		for (const chestId of CHEST_IDS) {
			const rewards = CHESTS[chestId].rewards;
			for (let i = 1; i < rewards.size(); i++) {
				Assert.true(rewards[i].weight <= rewards[i - 1].weight);
				Assert.true(ITEMS[rewards[i].item].bonus > ITEMS[rewards[i - 1].item].bonus);
			}
		}
	}

	// ---- the roll ----

	@Test
	public rollCoversTheWholeTable() {
		Assert.equal(rollChest("pet_chest", 0), "pet_mole");
		Assert.equal(rollChest("pet_chest", 0.449), "pet_mole");
		Assert.equal(rollChest("pet_chest", 0.45), "pet_beetle");
		Assert.equal(rollChest("pet_chest", 0.99), "pet_golem");
	}

	@Test
	public rollMatchesTheShownOdds() {
		// Walk the roll over [0, 1) in fine steps: the share of each item must equal its displayed chance.
		const steps = 10_000;
		const counts = new Map<string, number>();
		for (let i = 0; i < steps; i++) {
			const item = rollChest("speed_chest", i / steps);
			counts.set(item, (counts.get(item) ?? 0) + 1);
		}
		for (const line of chestOdds("speed_chest")) {
			const share = (counts.get(line.item) ?? 0) / steps;
			Assert.true(math.abs(share - line.chance) < 0.001, `${line.item}: ${share} vs ${line.chance}`);
		}
	}

	@Test
	public badRollsStillGiveAValidItem() {
		Assert.equal(rollChest("pet_chest", 0 / 0), "pet_mole");
		Assert.equal(rollChest("pet_chest", -5), "pet_mole");
		Assert.equal(rollChest("pet_chest", 1), "pet_golem");
		Assert.equal(rollChest("pet_chest", math.huge), "pet_golem");
	}

	// ---- opening with dollars ----

	@Test
	public dollarOpeningNeedsMoneyAndSpace() {
		const price = CHESTS.pet_chest.dollarPrice;
		Assert.true(canOpenWithDollars("pet_chest", price, 0).ok);
		Assert.false(canOpenWithDollars("pet_chest", price - 1, 0).ok);
		Assert.false(canOpenWithDollars("pet_chest", 0 / 0, 0).ok);
		const full = canOpenWithDollars("pet_chest", 1e9, INVENTORY_LIMIT);
		Assert.false(full.ok);
		if (!full.ok) {
			Assert.equal(full.reason, "inventory-full");
		}
	}

	// ---- inventory ----

	@Test
	public itemsGetUniqueUids() {
		const inventory: OwnedItem[] = [];
		const a = addItem(inventory, 1, "pet_mole");
		const b = addItem(inventory, 2, "pet_mole");
		Assert.notUndefined(a);
		Assert.true(a?.uid !== b?.uid);
		Assert.equal(removeItem(inventory, a?.uid ?? "")?.item, "pet_mole");
		Assert.equal(inventory.size(), 1);
		Assert.undefined(removeItem(inventory, "nope"));
	}

	@Test
	public hardCapIsNeverExceeded() {
		const inventory: OwnedItem[] = [];
		for (let i = 0; i < INVENTORY_HARD_LIMIT + 20; i++) {
			addItem(inventory, i, "pet_mole");
		}
		Assert.equal(inventory.size(), INVENTORY_HARD_LIMIT);
	}

	// ---- Robux receipts ----

	@Test
	public receiptsAreGrantedOnce() {
		const ids: string[] = [];
		Assert.false(wasGranted(ids, "r1"));
		rememberPurchase(ids, "r1");
		Assert.true(wasGranted(ids, "r1"));
	}

	@Test
	public receiptMemoryIsBounded() {
		const ids: string[] = [];
		for (let i = 0; i < MAX_REMEMBERED_PURCHASES + 50; i++) {
			rememberPurchase(ids, `r${i}`);
		}
		Assert.equal(ids.size(), MAX_REMEMBERED_PURCHASES);
		Assert.false(wasGranted(ids, "r0"));
		Assert.true(wasGranted(ids, `r${MAX_REMEMBERED_PURCHASES + 49}`));
	}
}

export = ChestsTests;
