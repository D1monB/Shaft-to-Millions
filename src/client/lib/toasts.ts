// Short messages at the top of the screen ("+1 Coal", "Bag is full").
import { Text } from "shared/features/i18n";
import { NotifyKind } from "shared/lib/remote-names";
import { tx } from "./i18n";
import { playSound } from "./sounds";
import { Store, useStore } from "./store";

export interface ToastEntry {
	readonly id: number;
	/**
	 * A Text (key + params) is translated when the toast is drawn, not when it arrives: a server message sent right
	 * after joining came before the language was chosen and stayed in English (play-test 2026-11-26).
	 */
	readonly text: string | Text;
	readonly kind: NotifyKind;
}

/** The words to draw, in the current language. */
export function toastText(entry: ToastEntry): string {
	return typeIs(entry.text, "string") ? entry.text : tx(entry.text);
}

/** More than this and old messages are dropped: a spammy event must not cover the screen. */
const MAX_TOASTS = 4;

const toastStore = new Store<ReadonlyArray<ToastEntry>>([]);
let lastId = 0;

export function toast(text: string | Text, kind: NotifyKind = "info", seconds = 3): void {
	lastId += 1;
	const id = lastId;
	const current = toastStore.get();
	const kept = current.size() >= MAX_TOASTS ? current.filter((_, index) => index > 0) : [...current];
	kept.push({ id, text, kind });
	toastStore.set(kept);
	// Info toasts ("+1 Coal") are frequent and stay quiet; only results the player cares about make a sound.
	if (kind === "success" || kind === "error") {
		playSound(kind);
	}
	task.delay(seconds, () => toastStore.set(toastStore.get().filter((entry) => entry.id !== id)));
}

export function useToasts(): ReadonlyArray<ToastEntry> {
	return useStore(toastStore);
}
