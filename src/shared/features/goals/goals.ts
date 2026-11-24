// "What should I do next?" - one clear hint for the HUD (CLAUDE.md: one hint, gradual unlocks).
// Pure: every feature contributes candidate goals, this file only picks the one to show.

export interface GoalCandidate {
	/** Short name of the thing to buy, e.g. "Сталева кирка". */
	readonly label: string;
	readonly price: number;
	/** Lower = more important at the same price range. Unlocking new ore beats a bigger bag. */
	readonly priority: number;
}

export interface GoalState {
	readonly money: number;
	readonly bagUsed: number;
	readonly bagCapacity: number;
}

/**
 * Picks the hint to show:
 * 1. A full bag always comes first: nothing else can progress until it is emptied.
 * 2. Something affordable right now (most important first).
 * 3. Otherwise the cheapest goal, with how much is missing.
 * 4. With no goals left: just keep mining.
 */
export function pickGoal(state: GoalState, candidates: ReadonlyArray<GoalCandidate>): string {
	if (state.bagCapacity > 0 && state.bagUsed >= state.bagCapacity) {
		return "Сумка повна: продай руду або віднеси на склад.";
	}
	const valid = candidates.filter((goal) => goal.price === goal.price && goal.price >= 0 && goal.price < math.huge);
	const affordable = valid.filter((goal) => state.money >= goal.price);
	if (affordable.size() > 0) {
		const best = [...affordable].sort(
			(a, b) => a.priority < b.priority || (a.priority === b.priority && a.price > b.price),
		)[0];
		return `Можна купити: ${best.label}!`;
	}
	if (valid.size() > 0) {
		const cheapest = [...valid].sort(
			(a, b) => a.price < b.price || (a.price === b.price && a.priority < b.priority),
		)[0];
		return `Ціль: ${cheapest.label}. Бракує $${math.ceil(cheapest.price - math.max(0, state.money))}.`;
	}
	if (state.bagUsed === 0) {
		return "Клікай по блоках руди, щоб добувати.";
	}
	return "Добувай глибше: там дорожча руда.";
}
