import { PlayerView } from "shared/features/profile";
import { NOTIFY_REMOTE, NotifyKind, STATE_UPDATE_REMOTE } from "shared/lib/remote-names";
import { onServerMessage } from "client/lib/remotes";
import { Store, useStore } from "client/lib/store";
import { toast } from "client/lib/toasts";

// The latest data from the server, or undefined until the first update arrives. Never edit it:
// the server replaces it with a fresh table on every update.
const viewStore = new Store<PlayerView | undefined>(undefined);

export function getView(): PlayerView | undefined {
	return viewStore.get();
}

/** Called on every update, and right away if data already arrived. For non-React code (world labels). */
export function onViewChanged(listener: (view: PlayerView) => void): void {
	const current = viewStore.get();
	if (current !== undefined) {
		listener(current);
	}
	viewStore.subscribe((view) => {
		if (view !== undefined) {
			listener(view);
		}
	});
}

/** React hook: the player's data, re-rendering on every server update. */
export function useView(): PlayerView | undefined {
	return useStore(viewStore);
}

const NOTIFY_KINDS = new Set<string>(["info", "success", "error"]);

export function startProfileController(): void {
	onServerMessage(STATE_UPDATE_REMOTE, (incoming) => {
		if (typeIs(incoming, "table")) {
			viewStore.set(incoming as PlayerView);
		}
	});
	onServerMessage(NOTIFY_REMOTE, (text, kind) => {
		if (typeIs(text, "string")) {
			toast(text, (typeIs(kind, "string") && NOTIFY_KINDS.has(kind) ? kind : "info") as NotifyKind);
		}
	});
}
