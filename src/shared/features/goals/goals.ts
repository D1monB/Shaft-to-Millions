// "What should I do next?" - one clear hint for the HUD (CLAUDE.md: one hint, gradual unlocks).
// Pure: every feature contributes candidate goals, this file only picks the one to show.

export interface GoalCandidate {
	/** Short name of the thing to buy, e.g. "Сталева кирка". */
	readonly label: string;
	readonly price: number;
	/** Lower = more important at the same price range. Unlocking new ore beats a bigger bag. */
	readonly priority: number;
	/** Something other than money is still missing, e.g. "Мідний злиток 2/5". Such a goal is never "affordable". */
	readonly missing?: string;
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
	readonly title: string;
	/** Short status on the right of the banner, e.g. "Бракує $150" or "Готово!". */
	readonly status: string;
	/** 0..1 for the bar under the title. */
	readonly progress: number;
	/** The whole hint as one sentence (used where there is room for only one line). */
	readonly text: string;
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
			title: "Сумка повна",
			status: "Продай руду",
			progress: 1,
			text: "Сумка повна: продай руду або віднеси на склад.",
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
			title: best.label,
			status: "Можна купити!",
			progress: 1,
			text: `Можна купити: ${best.label}!`,
		};
	}
	if (valid.size() > 0) {
		const cheapest = [...valid].sort(
			(a, b) => a.price < b.price || (a.price === b.price && a.priority < b.priority),
		)[0];
		if (cheapest.missing !== undefined && money >= cheapest.price) {
			return {
				kind: "saving",
				title: cheapest.label,
				status: cheapest.missing,
				progress: 1,
				text: `Ціль: ${cheapest.label}. Потрібно: ${cheapest.missing}.`,
			};
		}
		const missing = math.ceil(cheapest.price - money);
		return {
			kind: "saving",
			title: cheapest.label,
			status: `Бракує $${missing}`,
			// A price of 0 is always affordable, so here the price is above 0 and the division is safe.
			progress: math.clamp(money / cheapest.price, 0, 1),
			text: `Ціль: ${cheapest.label}. Бракує $${missing}.`,
		};
	}
	if (state.bagUsed === 0) {
		return {
			kind: "start",
			title: "Добувай руду",
			status: "Клікай по блоках",
			progress: 0,
			text: "Клікай по блоках руди, щоб добувати.",
		};
	}
	return {
		kind: "deeper",
		title: "Спускайся глибше",
		status: "Там дорожча руда",
		progress: 1,
		text: "Добувай глибше: там дорожча руда.",
	};
}

/** The hint as one sentence. */
export function pickGoal(state: GoalState, candidates: ReadonlyArray<GoalCandidate>): string {
	return pickGoalInfo(state, candidates).text;
}
