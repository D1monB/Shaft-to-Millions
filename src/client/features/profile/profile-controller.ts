import { PlayerView } from "shared/features/profile";
import { NOTIFY_REMOTE, NotifyKind, STATE_UPDATE_REMOTE } from "shared/lib/remote-names";
import { onServerMessage } from "client/lib/remotes";
import { refreshPanel, toast } from "client/lib/ui";

let view: PlayerView | undefined;
const listeners: Array<(view: PlayerView) => void> = [];

/** The latest data from the server, or undefined until the first update arrives. Never edit it. */
export function getView(): PlayerView | undefined {
	return view;
}

/** Called on every update, and right away if data already arrived. */
export function onViewChanged(listener: (view: PlayerView) => void): void {
	listeners.push(listener);
	if (view !== undefined) {
		listener(view);
	}
}

export function startProfileController(): void {
	onServerMessage(STATE_UPDATE_REMOTE, (incoming) => {
		if (!typeIs(incoming, "table")) {
			return;
		}
		view = incoming as PlayerView;
		for (const listener of listeners) {
			const [ok, err] = pcall(listener, view);
			if (!ok) {
				warn(`[profile] view listener failed: ${err}`);
			}
		}
		refreshPanel();
	});
	onServerMessage(NOTIFY_REMOTE, (text, kind) => {
		if (typeIs(text, "string")) {
			toast(text, (typeIs(kind, "string") ? kind : "info") as NotifyKind);
		}
	});
}
