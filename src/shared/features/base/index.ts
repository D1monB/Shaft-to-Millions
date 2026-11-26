// base feature (shared): buildings with real-time build timers, builders and their bonuses (decision 063).
// Public API of this feature. Other code imports only from this file.
export {
	MAX_BUILDERS,
	applySkip,
	applyStart,
	baseEffects,
	completeJobs,
	jobOf,
	levelOf,
	newBaseState,
	nextBuilderPrice,
	nextBuildingLevel,
	officeNeeded,
	secondsLeft,
	skipCost,
	totalLevels,
	tryHireBuilder,
	trySkip,
	tryStartBuild,
} from "./base";
export type { BaseEffects, BaseState, BuildJob, BuildRefusal, HireResult, SkipResult, StartBuildResult } from "./base";
export {
	BASE_SITE_ID_ATTRIBUTE,
	BASE_SITE_TAG,
	HIRE_BUILDER_REMOTE,
	SKIP_BUILD_REMOTE,
	START_BUILD_REMOTE,
} from "./network";
