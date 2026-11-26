// "Wear it" right after a chest or an aura spin (decision 067): equips the newest owned copy of the item. The server
// checks ownership as for any equip.
import { ItemId } from "shared/config/items";
import { EQUIP_REMOTE } from "shared/features/equipment";
import { getView } from "client/features/profile";
import { sendToServer } from "client/lib/remotes";

export function equipNewest(item: ItemId): void {
	const inventory = getView()?.inventory ?? [];
	for (let index = inventory.size() - 1; index >= 0; index--) {
		if (inventory[index].item === item) {
			sendToServer(EQUIP_REMOTE, inventory[index].uid);
			return;
		}
	}
}
