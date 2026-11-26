// The newcomer guide (decision 070): which step is next, read from the profile, so a donor who already bought better
// gear skips straight ahead. The player may close it at any time.
export type TutorialStep = "mine" | "sell" | "gear" | "plot" | "machine";

export interface TutorialStats {
	readonly oresMined: number;
	readonly totalEarned: number;
	/** Owns any item that is not a free starter. */
	readonly boughtGear: boolean;
	readonly hasPlot: boolean;
	readonly machines: number;
}

/** Ore pieces the first step asks for. */
export const TUTORIAL_ORE = 15;

/** The next step, or undefined when the guide is done. */
export function tutorialStep(stats: TutorialStats): TutorialStep | undefined {
	if (stats.machines > 0) {
		return undefined;
	}
	if (stats.oresMined < TUTORIAL_ORE) {
		return "mine";
	}
	if (stats.totalEarned <= 0) {
		return "sell";
	}
	if (!stats.boughtGear) {
		return "gear";
	}
	return stats.hasPlot ? "machine" : "plot";
}

/** Which extra menus a new player sees: they appear one by one (all at once once the guide is closed or done). */
export function menuUnlocked(menu: "base" | "aura" | "raid", stats: TutorialStats, guideClosed: boolean): boolean {
	if (guideClosed || tutorialStep(stats) === undefined) {
		return true;
	}
	if (menu === "aura") {
		return stats.totalEarned > 0;
	}
	return menu === "base" ? stats.boughtGear : stats.machines > 0;
}
