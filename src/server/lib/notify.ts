// Short messages to one player. Used for refusals the player should understand ("Bag is full"),
// never for silent anti-exploit drops. The message goes as a text key and values; the client shows it in the
// player's language (decision 033).
import { Text } from "shared/features/i18n";
import { NOTIFY_REMOTE, NotifyKind } from "shared/lib/remote-names";
import { fireClient } from "./remotes";

export function notify(player: Player, message: Text, kind: NotifyKind = "info"): void {
	fireClient(NOTIFY_REMOTE, player, message.key, message.params, kind);
}
