// The latest spin result. The server's message may arrive while the panel is closed, so it is remembered here and the
// reel subscribes while it is on screen.
import { ItemId } from "shared/config/items";

let latest: { item: ItemId } | undefined;
const listeners = new Set<(item: ItemId) => void>();

export function lastResult(): { item: ItemId } | undefined {
	return latest;
}

export function publishResult(item: ItemId): void {
	latest = { item };
	for (const listener of listeners) {
		listener(item);
	}
}

export function onResult(listener: (item: ItemId) => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
