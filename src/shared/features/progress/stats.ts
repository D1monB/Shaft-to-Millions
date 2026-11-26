// The profile numbers the progress rules read, in one place so server and client agree.
import { GEAR_SLOTS, starterOf } from "shared/features/upgrades";
import type { ProfileData } from "shared/features/profile";
import { AchievementStats } from "./titles";
import { TutorialStats } from "./tutorial";

export function statsOfProfile(data: ProfileData): AchievementStats {
	return {
		ore: data.stats.oresMined,
		earned: data.stats.totalEarned,
		layer: data.deepestLayer,
		machines: data.line.machines.size(),
		rebirths: data.rebirths,
	};
}

export function tutorialStatsOf(data: ProfileData, hasPlot: boolean): TutorialStats {
	const starters = GEAR_SLOTS.map(starterOf);
	return {
		oresMined: data.stats.oresMined,
		totalEarned: data.stats.totalEarned,
		boughtGear: data.gear.owned.some((id) => !starters.includes(id)),
		hasPlot,
		machines: data.line.machines.size(),
	};
}
