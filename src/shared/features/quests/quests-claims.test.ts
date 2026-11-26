import { Assert, Test } from "@rbxts/lunit";
import {
	CHAIN_QUESTS,
	DAILY_ALL_DONE_REWARD,
	DAILY_MONEY_GROWTH,
	DAILY_QUESTS,
	STREAK_REWARDS,
} from "shared/config/quests";
import { QuestSnapshot, QuestState, claimAllDone, claimChain, claimDaily, claimStreak, newQuestState } from "./quests";

const SNAPSHOT: QuestSnapshot = { machines: 0, deepestLayer: 1, ownedGear: [], beltLevel: 0, drills: 0 };

function stateWithCrits(count: number): QuestState {
	const state = newQuestState();
	state.daily = [{ id: "d_crits", count, claimed: false }];
	return state;
}

class QuestClaimsTests {
	@Test
	public claimDailyPaysOnceWhenDone() {
		const state = stateWithCrits(40);
		const first = claimDaily(state, 0, SNAPSHOT, 1);
		Assert.true(first.ok);
		Assert.true(state.daily[0].claimed);
		const second = claimDaily(state, 0, SNAPSHOT, 1);
		Assert.false(second.ok);
		if (!second.ok) Assert.equal(second.reason, "claimed");
	}

	@Test
	public claimDailyNotDoneChangesNothing() {
		const state = stateWithCrits(39);
		const result = claimDaily(state, 0, SNAPSHOT, 1);
		Assert.false(result.ok);
		if (!result.ok) Assert.equal(result.reason, "not-done");
		Assert.false(state.daily[0].claimed);
	}

	@Test
	public claimDailyRejectsBadIndexes() {
		const state = stateWithCrits(1000);
		const bad: unknown[] = [-1, 1, 1.5, 0 / 0, math.huge, "0", undefined, true, {}];
		for (const index of bad) {
			const result = claimDaily(state, index, SNAPSHOT, 1);
			Assert.false(result.ok);
			if (!result.ok) Assert.equal(result.reason, "unknown");
		}
		Assert.false(state.daily[0].claimed);
	}

	@Test
	public claimDailyUsesScaledTargetAndMoney() {
		// 40 crits is enough on layer 1 but not on layer 2 (target grows).
		const state = stateWithCrits(40);
		Assert.false(claimDaily(state, 0, SNAPSHOT, 2).ok);
		state.daily[0].count = 1000;
		const result = claimDaily(state, 0, SNAPSHOT, 2);
		Assert.true(result.ok);
		if (result.ok) {
			const base = DAILY_QUESTS.find((quest) => quest.id === "d_crits");
			Assert.equal(result.reward.money, math.floor((base?.reward.money ?? 0) * DAILY_MONEY_GROWTH));
			Assert.equal(result.reward.crystals, base?.reward.crystals);
		}
	}

	@Test
	public claimDailyUnknownQuestIdIsRefused() {
		const state = newQuestState();
		state.daily = [{ id: "gone_quest", count: 999, claimed: false }];
		Assert.false(claimDaily(state, 0, SNAPSHOT, 1).ok);
		Assert.false(state.daily[0].claimed);
	}

	@Test
	public claimAllDoneOnlyAfterAllClaimedAndOnce() {
		const state = newQuestState();
		Assert.false(claimAllDone(state).ok);
		state.daily = [
			{ id: "d_crits", count: 0, claimed: true },
			{ id: "d_sell", count: 0, claimed: false },
		];
		Assert.false(claimAllDone(state).ok);
		state.daily[1].claimed = true;
		const result = claimAllDone(state);
		Assert.true(result.ok);
		if (result.ok) Assert.equal(result.reward.crystals, DAILY_ALL_DONE_REWARD.crystals);
		Assert.false(claimAllDone(state).ok);
	}

	@Test
	public claimChainAdvancesAndResetsCount() {
		const state = newQuestState();
		state.chainCount = 20;
		const result = claimChain(state, SNAPSHOT);
		Assert.true(result.ok);
		if (result.ok) Assert.equal(result.reward.money, CHAIN_QUESTS[0].reward.money);
		Assert.equal(state.chain, 1);
		Assert.equal(state.chainCount, 0);
	}

	@Test
	public claimChainRefusesWhenNotDone() {
		const state = newQuestState();
		state.chainCount = 19;
		const result = claimChain(state, SNAPSHOT);
		Assert.false(result.ok);
		if (!result.ok) Assert.equal(result.reason, "not-done");
		Assert.equal(state.chain, 0);
		Assert.equal(state.chainCount, 19);
	}

	@Test
	public claimChainRefusesPastTheEnd() {
		const state = newQuestState();
		state.chain = CHAIN_QUESTS.size();
		state.chainCount = 1e12;
		const result = claimChain(state, SNAPSHOT);
		Assert.false(result.ok);
		if (!result.ok) Assert.equal(result.reason, "unknown");
		Assert.equal(state.chain, CHAIN_QUESTS.size());
	}

	@Test
	public claimChainStateQuestCountsOldProgress() {
		const state = newQuestState();
		state.chain = CHAIN_QUESTS.findIndex((quest) => quest.id === "c_machine_1");
		Assert.false(claimChain(state, SNAPSHOT).ok);
		Assert.true(claimChain(state, { ...SNAPSHOT, machines: 2 }).ok);
	}

	@Test
	public claimStreakOncePerDay() {
		const state = newQuestState();
		state.loginDay = 100;
		state.streak = 1;
		const result = claimStreak(state, 100);
		Assert.true(result.ok);
		if (result.ok) Assert.equal(result.reward.money, STREAK_REWARDS[0].money);
		const again = claimStreak(state, 100);
		Assert.false(again.ok);
		if (!again.ok) Assert.equal(again.reason, "claimed");
	}

	@Test
	public claimStreakRefusedWhenLoginDayIsNotToday() {
		const state = newQuestState();
		state.loginDay = 100;
		state.streak = 3;
		Assert.false(claimStreak(state, 101).ok);
		Assert.false(claimStreak(state, 99).ok);
		Assert.false(claimStreak(state, 0).ok);
		Assert.false(claimStreak(state, 0 / 0).ok);
		Assert.equal(state.streakClaimedDay, 0);
	}

	@Test
	public claimStreakRefusedForFreshState() {
		// A never-rolled state has streak 0 and must not pay out.
		Assert.false(claimStreak(newQuestState(), 100).ok);
	}
}

export = QuestClaimsTests;
