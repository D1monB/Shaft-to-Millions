/** Client -> server: (buildingId: string). Pays and starts the next level. */
export const START_BUILD_REMOTE = "StartBuild";
/** Client -> server: (buildingId: string). Finishes a running build with crystals. */
export const SKIP_BUILD_REMOTE = "SkipBuild";
/** Client -> server: no arguments. Hires the next builder with crystals. */
export const HIRE_BUILDER_REMOTE = "HireBuilder";
