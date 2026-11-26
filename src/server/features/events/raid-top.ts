// The weekly raid top (decision 065): one OrderedDataStore per week on live servers, memory in Studio. Every call may
// fail; the caller wraps it in pcall and keeps the previous rows.
import { DataStoreService, Players, RunService } from "@rbxts/services";
import { RAID_TOP_SIZE } from "shared/config/events";
import { RaidRow } from "shared/features/events";
import { isFiniteNumber } from "shared/lib/validate";

const memory = new Map<number, Map<number, number>>();
const names = new Map<number, string>();

function storeName(week: number): string {
	return `RaidWeek_${week}`;
}

/** Raises a user's best of the week; never lowers it. */
export function raiseRaidScore(week: number, userId: number, score: number): void {
	if (RunService.IsStudio()) {
		let rows = memory.get(week);
		if (rows === undefined) {
			rows = new Map();
			memory.set(week, rows);
		}
		rows.set(userId, math.max(rows.get(userId) ?? 0, score));
		return;
	}
	DataStoreService.GetOrderedDataStore(storeName(week)).UpdateAsync(tostring(userId), (old) => {
		const current = typeIs(old, "number") ? old : 0;
		return math.max(current, math.floor(score));
	});
}

function nameOf(userId: number): string {
	const known = names.get(userId);
	if (known !== undefined) {
		return known;
	}
	const here = Players.GetPlayerByUserId(userId);
	const name = here !== undefined ? here.Name : Players.GetNameFromUserIdAsync(userId as unknown as User);
	names.set(userId, name);
	return name;
}

function rawTop(week: number): Array<[number, number]> {
	if (RunService.IsStudio()) {
		const rows: Array<[number, number]> = [];
		for (const [userId, score] of memory.get(week) ?? new Map<number, number>()) {
			rows.push([userId, score]);
		}
		rows.sort((a, b) => a[1] > b[1]);
		return rows;
	}
	const page = DataStoreService.GetOrderedDataStore(storeName(week))
		.GetSortedAsync(false, RAID_TOP_SIZE)
		.GetCurrentPage();
	const rows: Array<[number, number]> = [];
	for (const entry of page) {
		const userId = tonumber(entry.key);
		const score = entry.value;
		if (userId !== undefined && typeIs(score, "number") && isFiniteNumber(score)) {
			rows.push([userId, score]);
		}
	}
	return rows;
}

export function readRaidTop(week: number): RaidRow[] {
	const rows: RaidRow[] = [];
	for (const [userId, score] of rawTop(week)) {
		if (rows.size() >= RAID_TOP_SIZE) {
			break;
		}
		const [ok, name] = pcall(nameOf, userId);
		rows.push({ name: ok ? (name as string) : "Player", score });
	}
	return rows;
}
