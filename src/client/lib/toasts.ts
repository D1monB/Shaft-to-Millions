// Short messages at the top of the screen ("+1 Coal", "Bag is full").
import { NotifyKind } from "shared/lib/remote-names";
import { Store, useStore } from "./store";

export interface ToastEntry {
	readonly id: number;
	readonly text: string;
	readonly kind: NotifyKind;
}

/** More than this and old messages are dropped: a spammy event must not cover the screen. */
const MAX_TOASTS = 4;

const toastStore = new Store<ReadonlyArray<ToastEntry>>([]);
let lastId = 0;

export function toast(text: string, kind: NotifyKind = "info", seconds = 3): void {
	lastId += 1;
	const id = lastId;
	const current = toastStore.get();
	const kept = current.size() >= MAX_TOASTS ? current.filter((_, index) => index > 0) : [...current];
	kept.push({ id, text, kind });
	toastStore.set(kept);
	task.delay(seconds, () => toastStore.set(toastStore.get().filter((entry) => entry.id !== id)));
}

export function useToasts(): ReadonlyArray<ToastEntry> {
	return useStore(toastStore);
}
