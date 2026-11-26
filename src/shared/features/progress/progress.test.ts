import { Assert, Test } from "@rbxts/lunit";
import { CALENDAR_DAYS, CREATURES, MAX_REBIRTHS, REBIRTH_PRICE } from "shared/config/retention";
import { INVENTORY_LIMIT, ITEMS } from "shared/config/items";
import { newQuestState, questProgress, skipChain } from "shared/features/quests";
import { calendarReward, claimCalendarDay, newCalendarState } from "./calendar";
import { liveBonuses, liveEventAt } from "./live-events";
import { canRebirth, rebirthMultiplier, rebirthPrice } from "./rebirth";
import { friendBonus } from "./social";
import { canOffer, tames } from "./taming";
import { ACHIEVEMENTS, isUnlocked } from "./titles";
import { menuUnlocked, tutorialStep } from "./tutorial";

const FRESH = { oresMined: 0, totalEarned: 0, boughtGear: false, hasPlot: false, machines: 0 };
// 2026-11-28 is a Saturday, 2026-12-02 a Wednesday (UTC noon).
const SATURDAY = 1_795_867_200;

class ProgressTests {
	@Test
	public calendarMovesOnceADayAndWraps() {
		const state = newCalendarState();
		Assert.equal(claimCalendarDay(state, 100), 1);
		Assert.equal(claimCalendarDay(state, 100), undefined);
		Assert.equal(claimCalendarDay(state, 99), undefined);
		Assert.equal(claimCalendarDay(state, 105), 2);
		state.claimed = CALENDAR_DAYS - 1;
		Assert.equal(claimCalendarDay(state, 106), CALENDAR_DAYS);
		Assert.equal(state.claimed, 0);
		Assert.equal(claimCalendarDay(state, 0), undefined);
	}

	@Test
	public calendarRewardsSurviveBadInput() {
		for (const day of [0, -5, 0 / 0, 999]) {
			const reward = calendarReward(day, 0 / 0);
			Assert.true(reward.crystals > 0 && reward.money >= 0, `day ${day}`);
		}
		Assert.true(calendarReward(CALENDAR_DAYS, 1).boosters.size() > 1);
		Assert.true(calendarReward(2, 3).money > calendarReward(2, 1).money);
	}

	@Test
	public rebirthGetsPricierAndStops() {
		Assert.equal(rebirthPrice(0), REBIRTH_PRICE);
		Assert.true((rebirthPrice(1) as number) > REBIRTH_PRICE);
		Assert.equal(rebirthPrice(MAX_REBIRTHS), undefined);
		Assert.false(canRebirth(0, REBIRTH_PRICE - 1));
		Assert.true(canRebirth(0, REBIRTH_PRICE));
		Assert.false(canRebirth(0, 0 / 0));
		Assert.false(canRebirth(MAX_REBIRTHS, math.huge));
		Assert.equal(rebirthMultiplier(0 / 0), 1);
		Assert.true(rebirthMultiplier(2) > rebirthMultiplier(1));
	}

	@Test
	public guideSkipsStepsADonorAlreadyDid() {
		Assert.equal(tutorialStep(FRESH), "mine");
		Assert.equal(tutorialStep({ ...FRESH, oresMined: 99 }), "sell");
		Assert.equal(tutorialStep({ ...FRESH, oresMined: 99, totalEarned: 5, boughtGear: true }), "plot");
		Assert.equal(tutorialStep({ ...FRESH, machines: 1 }), undefined);
		Assert.false(menuUnlocked("raid", FRESH, false));
		Assert.true(menuUnlocked("raid", FRESH, true));
	}

	@Test
	public betterGearFinishesAGearQuestAndStepsCanBeSkipped() {
		const quest = { id: "t", kind: "gear" as const, gear: "pickaxe_copper", target: 1, reward: {} };
		const base = { machines: 0, deepestLayer: 1, beltLevel: 1, drills: 0 };
		Assert.equal(questProgress(quest, 0, { ...base, ownedGear: ["pickaxe_wood"] }), 0);
		Assert.equal(questProgress(quest, 0, { ...base, ownedGear: ["pickaxe_gold"] }), 1);
		const state = newQuestState();
		Assert.true(skipChain(state));
		Assert.equal(state.chain, 1);
		state.chain = 10_000;
		Assert.false(skipChain(state));
	}

	@Test
	public titlesUnlockOnlyWithRealNumbers() {
		const none = { ore: 0, earned: 0, layer: 1, machines: 0, rebirths: 0 };
		for (const def of ACHIEVEMENTS) {
			Assert.false(isUnlocked(def, none), def.id);
			Assert.false(isUnlocked(def, { ...none, [def.metric]: 0 / 0 }), def.id);
			Assert.true(isUnlocked(def, { ...none, [def.metric]: def.target }), def.id);
		}
	}

	@Test
	public friendsAndTamingAreBounded() {
		Assert.equal(friendBonus(-2), 0);
		Assert.equal(friendBonus(0 / 0), 0);
		Assert.equal(friendBonus(99), friendBonus(3));
		for (const def of CREATURES) {
			Assert.equal(ITEMS[def.pet].kind, "pet", def.pet);
			Assert.false(tames(def, 0 / 0));
			Assert.false(tames(def, -1));
			Assert.false(tames(def, def.chance));
			Assert.true(tames(def, 0));
		}
		const mole = CREATURES[0];
		Assert.true(canOffer(mole, 1, mole.amount, 0).ok);
		Assert.false(canOffer(mole, 0, 1e6, 0).ok);
		Assert.false(canOffer(mole, 1, mole.amount - 1, 0).ok);
		Assert.false(canOffer(mole, 1, 1e6, INVENTORY_LIMIT).ok);
	}

	@Test
	public liveEventsFollowTheCalendar() {
		Assert.equal(liveEventAt(SATURDAY), "ore_weekend");
		Assert.equal(liveEventAt(0 / 0), undefined);
		Assert.equal(liveEventAt(-1), undefined);
		Assert.equal(liveBonuses(undefined).ore, 1);
		Assert.true(liveBonuses("ore_weekend").ore > 1);
	}
}

export = ProgressTests;
