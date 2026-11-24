import { PlainTable, fillMissing } from "shared/lib/tables";
import { MIGRATIONS, Migration, MigrationFailure, migrate } from "./migrations";
import { sanitize } from "./sanitize";
import { CURRENT_SCHEMA_VERSION, ProfileData, createDefaultProfileData, isProfileData } from "./schema";

export type LoadFailure = "not-a-table" | MigrationFailure | "invalid-shape";

export type LoadResult =
	{ ok: true; data: ProfileData; repairs: string[] } | { ok: false; reason: LoadFailure; detail?: string };

/**
 * The one entry point that turns whatever is in the DataStore into usable, valid ProfileData.
 *
 * Pipeline: migrate a copy -> fill fields added after the save was written -> repair bad values -> check shape.
 * On any failure the input is untouched, so the caller can release the session without overwriting the save.
 * Running it on already-loaded data changes nothing (idempotent).
 *
 * `migrations` and `targetVersion` are parameters only so tests can exercise a multi-step chain.
 */
export function loadProfileData(
	raw: unknown,
	migrations: ReadonlyArray<Migration> = MIGRATIONS,
	targetVersion: number = CURRENT_SCHEMA_VERSION,
): LoadResult {
	if (!typeIs(raw, "table")) {
		return { ok: false, reason: "not-a-table" };
	}

	const migrated = migrate(raw as PlainTable, migrations, targetVersion);
	if (!migrated.ok) {
		return { ok: false, reason: migrated.reason, detail: migrated.detail };
	}

	const data = migrated.data;
	// Adding a field with a default is the common, safe way to extend the save: old saves just get the default.
	fillMissing(data, createDefaultProfileData() as unknown as PlainTable);
	const repairs = sanitize(data);

	if (!isProfileData(data)) {
		return { ok: false, reason: "invalid-shape" };
	}
	return { ok: true, data, repairs };
}
