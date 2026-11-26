import { Assert, Test } from "@rbxts/lunit";
import { BELT_LEVELS, LINE_MACHINES } from "shared/config/line";
import { LAYER_COUNT } from "shared/config/layers";
import { ORE_IDS } from "shared/config/ores";
import {
	CHAIN_QUESTS,
	DAILY_COUNT,
	DAILY_MONEY_GROWTH,
	DAILY_QUESTS,
	DAILY_TARGET_GROWTH,
	QuestDef,
	STREAK_REWARDS,
} from "shared/config/quests";
import { findGear } from "shared/features/upgrades";
import {
	QuestSnapshot,
	dayOf,
	newQuestState,
	pickDaily,
	questProgress,
	recordEvent,
	rollOver,
	scaledDaily,
	streakReward,
} from "./quests";

const EMPTY: QuestSnapshot = { machines: 0, deepestLayer: 1, ownedGear: [], beltLevel: 0, drills: 0 };

function def(kind: QuestDef["kind"], extra?: Partial<QuestDef>): QuestDef {
	return { id: "x", kind, target: 5, reward: { money: 10 }, ...extra };
}

function distinct(ids: string[]): boolean {
	const seen = new Set<string>();
	for (const id of ids) {
		if (seen.has(id)) return false;
		seen.add(id);
	}
	return true;
}

class QuestsTests {
	@Test
	public dayOfConvertsSecondsToDays() {
		Assert.equal(dayOf(0), 0);
		Assert.equal(dayOf(86_399), 0);
		Assert.equal(dayOf(86_400), 1);
		Assert.equal(dayOf(86_400 * 20_000 + 5), 20_000);
	}

	@Test
	public dayOfBadInputIsZero() {
		Assert.equal(dayOf(-5), 0);
		Assert.equal(dayOf(0 / 0), 0);
		Assert.equal(dayOf(math.huge), 0);
		Assert.equal(dayOf(-math.huge), 0);
	}

	@Test
	public pickDailyGivesDistinctIdsForAnyRoll() {
		for (const value of [0, 0.5, 0.999, 1, -1, 0 / 0, math.huge, -math.huge]) {
			const picked = pickDaily(() => value);
			Assert.equal(picked.size(), DAILY_COUNT);
			Assert.true(distinct(picked.map((entry) => entry.id)));
			for (const entry of picked) {
				Assert.equal(entry.count, 0);
				Assert.false(entry.claimed);
			}
		}
	}

	@Test
	public rollOverRollsNewDayAndStartsStreak() {
		const state = newQuestState();
		Assert.true(rollOver(state, 100, () => 0));
		Assert.equal(state.day, 100);
		Assert.equal(state.daily.size(), DAILY_COUNT);
		Assert.equal(state.streak, 1);
		Assert.equal(state.loginDay, 100);
	}

	@Test
	public rollOverConsecutiveDayAddsToStreak() {
		const state = newQuestState();
		rollOver(state, 100, () => 0);
		state.allDoneClaimed = true;
		Assert.true(rollOver(state, 101, () => 0));
		Assert.equal(state.streak, 2);
		// A new day must reopen the all-done bonus.
		Assert.false(state.allDoneClaimed);
	}

	@Test
	public rollOverGapResetsStreak() {
		const state = newQuestState();
		rollOver(state, 100, () => 0);
		rollOver(state, 101, () => 0);
		rollOver(state, 103, () => 0);
		Assert.equal(state.streak, 1);
	}

	@Test
	public rollOverSameOrOlderDayChangesNothing() {
		const state = newQuestState();
		rollOver(state, 100, () => 0);
		Assert.false(rollOver(state, 100, () => 0));
		Assert.false(rollOver(state, 99, () => 0));
		Assert.equal(state.day, 100);
		Assert.equal(state.streak, 1);
	}

	@Test
	public rollOverBadTodayChangesNothing() {
		const state = newQuestState();
		Assert.false(rollOver(state, 0, () => 0));
		Assert.false(rollOver(state, 0 / 0, () => 0));
		Assert.false(rollOver(state, -3, () => 0));
		Assert.equal(state.day, 0);
		Assert.equal(state.daily.size(), 0);
	}

	@Test
	public streakContinuesPastDaySevenAndRewardWraps() {
		const state = newQuestState();
		for (let day = 100; day < 108; day++) {
			rollOver(state, day, () => 0);
		}
		Assert.equal(state.streak, 8);
		Assert.equal(streakReward(8).money, STREAK_REWARDS[0].money);
		Assert.equal(streakReward(7).money, STREAK_REWARDS[6].money);
		Assert.equal(streakReward(15).money, STREAK_REWARDS[0].money);
	}

	@Test
	public streakRewardBadInputGivesDayOne() {
		Assert.equal(streakReward(0).money, STREAK_REWARDS[0].money);
		Assert.equal(streakReward(-4).money, STREAK_REWARDS[0].money);
		Assert.equal(streakReward(0 / 0).money, STREAK_REWARDS[0].money);
		Assert.equal(streakReward(math.huge).money, STREAK_REWARDS[0].money);
	}

	@Test
	public recordEventCountsMatchingKindOnly() {
		const state = newQuestState();
		state.daily = [{ id: "d_crits", count: 0, claimed: false }];
		Assert.true(recordEvent(state, "crits", 3));
		Assert.equal(state.daily[0].count, 3);
		Assert.false(recordEvent(state, "sellBag", 1));
		Assert.equal(state.daily[0].count, 3);
	}

	@Test
	public recordEventIgnoresClaimedDailies() {
		const state = newQuestState();
		state.daily = [{ id: "d_crits", count: 40, claimed: true }];
		recordEvent(state, "crits", 5);
		Assert.equal(state.daily[0].count, 40);
	}

	@Test
	public recordEventFiltersOreForChainQuest() {
		const state = newQuestState();
		state.chain = CHAIN_QUESTS.findIndex((quest) => quest.id === "c_copper_100");
		Assert.false(recordEvent(state, "mineOre", 10, "iron"));
		Assert.false(recordEvent(state, "mineOre", 10));
		Assert.equal(state.chainCount, 0);
		Assert.true(recordEvent(state, "mineOre", 10, "copper"));
		Assert.equal(state.chainCount, 10);
	}

	@Test
	public recordEventDailyWithoutOreCountsAnyOre() {
		const state = newQuestState();
		state.daily = [{ id: "d_mine", count: 0, claimed: false }];
		recordEvent(state, "mineOre", 2, "gold");
		Assert.equal(state.daily[0].count, 2);
	}

	@Test
	public recordEventRejectsBadAmounts() {
		const state = newQuestState();
		state.daily = [{ id: "d_crits", count: 0, claimed: false }];
		for (const amount of [0, -1, 0 / 0, math.huge, -math.huge]) {
			Assert.false(recordEvent(state, "crits", amount));
		}
		Assert.equal(state.daily[0].count, 0);
	}

	@Test
	public recordEventSpamStaysFinite() {
		const state = newQuestState();
		state.daily = [{ id: "d_crits", count: 0, claimed: false }];
		for (let i = 0; i < 1000; i++) {
			recordEvent(state, "crits", 1e11);
		}
		Assert.true(state.daily[0].count <= 1e12);
	}

	@Test
	public questProgressStateKindsReadSnapshot() {
		const snapshot: QuestSnapshot = {
			machines: 4,
			deepestLayer: 3,
			ownedGear: ["bag_leather"],
			beltLevel: 2,
			drills: 1,
		};
		// The counted value must be ignored for state kinds, so old progress counts.
		Assert.equal(questProgress(def("machines"), 99, snapshot), 4);
		Assert.equal(questProgress(def("layer"), 99, snapshot), 3);
		Assert.equal(questProgress(def("belt"), 99, snapshot), 2);
		Assert.equal(questProgress(def("drills"), 99, snapshot), 1);
		Assert.equal(questProgress(def("gear", { gear: "bag_leather" }), 0, snapshot), 1);
		Assert.equal(questProgress(def("gear", { gear: "shoes_miner" }), 0, snapshot), 0);
		Assert.equal(questProgress(def("gear"), 0, snapshot), 0);
	}

	@Test
	public questProgressEventKindsUseCountAndSurviveNaN() {
		Assert.equal(questProgress(def("crits"), 7, EMPTY), 7);
		Assert.equal(questProgress(def("crits"), 0 / 0, EMPTY), 0);
		Assert.equal(questProgress(def("crits"), math.huge, EMPTY), 0);
	}

	@Test
	public scaledDailyGrowsWithLayerAndKeepsCrystals() {
		const base = DAILY_QUESTS[0];
		const deep = scaledDaily(base, 3);
		Assert.equal(deep.target, math.floor(base.target * math.pow(DAILY_TARGET_GROWTH, 2)));
		Assert.equal(deep.reward.money, math.floor((base.reward.money ?? 0) * math.pow(DAILY_MONEY_GROWTH, 2)));
		Assert.equal(deep.reward.crystals, base.reward.crystals);
		const first = scaledDaily(base, 1);
		Assert.equal(first.target, base.target);
		Assert.equal(first.reward.money, base.reward.money);
	}

	@Test
	public scaledDailyBrokenLayerIsSafe() {
		const base = DAILY_QUESTS[0];
		for (const layer of [0 / 0, -5, 0, math.huge]) {
			const scaled = scaledDaily(base, layer);
			Assert.true(scaled.target >= 1);
			Assert.true(scaled.target === scaled.target);
			Assert.true(scaled.reward.money !== undefined && scaled.reward.money < math.huge);
		}
		// Garbage input must never be cheaper than layer 1.
		Assert.equal(scaledDaily(base, -5).target, base.target);
		Assert.equal(scaledDaily(base, 0 / 0).target, base.target);
		Assert.equal(scaledDaily(base, 1e9).target, scaledDaily(base, 20).target);
	}

	@Test
	public configHasUniqueIdsAndPositiveTargets() {
		Assert.true(distinct(DAILY_QUESTS.map((quest) => quest.id)));
		Assert.true(distinct(CHAIN_QUESTS.map((quest) => quest.id)));
		for (const quest of [...DAILY_QUESTS, ...CHAIN_QUESTS]) {
			Assert.true(quest.target > 0);
		}
		Assert.true(DAILY_QUESTS.size() >= DAILY_COUNT);
	}

	@Test
	public configReferencesExist() {
		for (const quest of CHAIN_QUESTS) {
			if (quest.kind === "gear") {
				Assert.true(quest.gear !== undefined && findGear(quest.gear) !== undefined);
			}
			if (quest.ore !== undefined) {
				Assert.true(ORE_IDS.includes(quest.ore));
			}
			if (quest.kind === "layer") {
				Assert.true(quest.target <= LAYER_COUNT);
			}
			if (quest.kind === "machines") {
				Assert.true(quest.target <= LINE_MACHINES.size());
			}
			if (quest.kind === "belt") {
				Assert.true(quest.target <= BELT_LEVELS.size());
			}
		}
	}
}

export = QuestsTests;
