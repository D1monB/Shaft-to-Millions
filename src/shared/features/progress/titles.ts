// Achievements and the titles they unlock (decision 070). Unlocks are read from the profile, never stored, so old
// progress counts and a title can never be forged: the server checks it again before showing it.
import { isFiniteNumber } from "shared/lib/validate";

export type AchievementMetric = "ore" | "earned" | "layer" | "machines" | "rebirths";

export interface AchievementDef {
	readonly id: string;
	readonly metric: AchievementMetric;
	readonly target: number;
	/** RGB of the title over the head. */
	readonly color: readonly [number, number, number];
}

export const ACHIEVEMENTS: ReadonlyArray<AchievementDef> = [
	{ id: "digger", metric: "ore", target: 100, color: [200, 160, 120] },
	{ id: "miner", metric: "ore", target: 5_000, color: [120, 200, 120] },
	{ id: "ore_king", metric: "ore", target: 100_000, color: [255, 190, 60] },
	{ id: "trader", metric: "earned", target: 10_000, color: [140, 220, 140] },
	{ id: "millionaire", metric: "earned", target: 1_000_000, color: [255, 215, 80] },
	{ id: "tycoon", metric: "earned", target: 1_000_000_000, color: [255, 120, 220] },
	{ id: "explorer", metric: "layer", target: 3, color: [100, 180, 255] },
	{ id: "abyss", metric: "layer", target: 5, color: [180, 110, 255] },
	{ id: "engineer", metric: "machines", target: 6, color: [120, 230, 230] },
	{ id: "industrialist", metric: "machines", target: 12, color: [255, 140, 80] },
	{ id: "reborn", metric: "rebirths", target: 1, color: [255, 90, 90] },
	{ id: "legend", metric: "rebirths", target: 5, color: [255, 60, 200] },
];

export type AchievementStats = { readonly [K in AchievementMetric]: number };

export function findAchievement(id: unknown): AchievementDef | undefined {
	return typeIs(id, "string") ? ACHIEVEMENTS.find((def) => def.id === id) : undefined;
}

export function isUnlocked(def: AchievementDef, stats: AchievementStats): boolean {
	const value = stats[def.metric];
	return isFiniteNumber(value) && value >= def.target;
}
