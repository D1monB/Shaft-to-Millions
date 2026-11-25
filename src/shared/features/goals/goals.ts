// "What should I do next?" - one clear hint for the HUD (CLAUDE.md: one hint, gradual unlocks).
// Pure: every feature contributes candidate goals, this file only picks the one to show. Texts are keys (decision
// 033): the HUD shows them in the player's language.
import { StringKey } from "shared/config/i18n";
import { SOURCE_LANGUAGE, Text, ref, text, translateText } from "shared/features/i18n";

export interface GoalCandidate {
	/** Name key of the thing to buy, e.g. "gear.pickaxe_silver". */
	readonly label: StringKey;
	readonly price: number;
	/** Lower = more important at the same price range. Unlocking new ore beats a bigger bag. */
	readonly priority: number;
	/** Name key of something other than money that is still missing. Such a goal is never "affordable". */
	readonly missing?: StringKey;
}

export interface GoalState {
	readonly money: number;
	readonly bagUsed: number;
	readonly bagCapacity: number;
}

export type GoalKind = "bag-full" | "affordable" | "saving" | "start" | "deeper";

/** The chosen goal in parts, so the HUD can show a title, a status and a progress bar. */
export interface GoalInfo {
	readonly kind: GoalKind;
	/** Short title: the thing to buy, or what to do. */
	readonly title: Text;
	/** Short status on the right of the banner, e.g. "Need $150". */
	readonly status: Text;
	/** 0..1 for the bar under the title. */
	readonly progress: number;
	/** The whole hint as one sentence (used where there is room for only one line). */
	readonly text: Text;
}

function safeMoney(money: number): number {
	return money === money && money > 0 ? math.min(money, math.huge) : 0;
}

/**
 * Picks the hint to show:
 * 1. A full bag always comes first: nothing else can progress until it is emptied.
 * 2. Something affordable right now (most important first).
 * 3. Otherwise the cheapest goal, with how much is missing.
 * 4. With no goals left: just keep mining.
 */
export function pickGoalInfo(state: GoalState, candidates: ReadonlyArray<GoalCandidate>): GoalInfo {
	if (state.bagCapacity > 0 && state.bagUsed >= state.bagCapacity) {
		return {
			kind: "bag-full",
			title: text("goal.bagFull.title"),
			status: text("goal.bagFull.status"),
			progress: 1,
			text: text("goal.bagFull.text"),
		};
	}
	const money = safeMoney(state.money);
	const valid = candidates.filter((goal) => goal.price === goal.price && goal.price >= 0 && goal.price < math.huge);
	const affordable = valid.filter((goal) => money >= goal.price && goal.missing === undefined);
	if (affordable.size() > 0) {
		const best = [...affordable].sort(
			(a, b) => a.priority < b.priority || (a.priority === b.priority && a.price > b.price),
		)[0];
		return {
			kind: "affordable",
			title: text(best.label),
			status: text("goal.affordable.status"),
			progress: 1,
			text: text("goal.affordable.text", { name: ref(best.label) }),
		};
	}
	if (valid.size() > 0) {
		const cheapest = [...valid].sort(
			(a, b) => a.price < b.price || (a.price === b.price && a.priority < b.priority),
		)[0];
		if (cheapest.missing !== undefined && money >= cheapest.price) {
			return {
				kind: "saving",
				title: text(cheapest.label),
				status: text(cheapest.missing),
				progress: 1,
				text: text("goal.saving.textOther", { name: ref(cheapest.label), missing: ref(cheapest.missing) }),
			};
		}
		const missing = math.ceil(cheapest.price - money);
		return {
			kind: "saving",
			title: text(cheapest.label),
			status: text("goal.saving.missing", { money: missing }),
			// A price of 0 is always affordable, so here the price is above 0 and the division is safe.
			progress: math.clamp(money / cheapest.price, 0, 1),
			text: text("goal.saving.text", { name: ref(cheapest.label), money: missing }),
		};
	}
	if (state.bagUsed === 0) {
		return {
			kind: "start",
			title: text("goal.start.title"),
			status: text("goal.start.status"),
			progress: 0,
			text: text("goal.start.text"),
		};
	}
	return {
		kind: "deeper",
		title: text("goal.deeper.title"),
		status: text("goal.deeper.status"),
		progress: 1,
		text: text("goal.deeper.text"),
	};
}

/** The hint as one English sentence (tests and logs; the HUD translates GoalInfo itself). */
export function pickGoal(state: GoalState, candidates: ReadonlyArray<GoalCandidate>): string {
	return translateText(SOURCE_LANGUAGE, pickGoalInfo(state, candidates).text);
}
