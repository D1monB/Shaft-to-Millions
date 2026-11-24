// Short messages to one player. Used for refusals the player should understand ("Bag is full"),
// never for silent anti-exploit drops.
import { NOTIFY_REMOTE, NotifyKind } from "shared/lib/remote-names";
import { fireClient } from "./remotes";

export function notify(player: Player, text: string, kind: NotifyKind = "info"): void {
	fireClient(NOTIFY_REMOTE, player, text, kind);
}
