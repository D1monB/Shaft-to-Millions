// equipment feature (shared): slots, combined bonuses with caps, best loadout, selling spare items.
// Public API of this feature. Other code imports only from this file.
export {
	BONUS_CAPS,
	ITEM_SELL_VALUE,
	MAX_PETS,
	bestLoadout,
	computeBonuses,
	equipItem,
	isEquipped,
	itemSellValue,
	newEquipped,
	sellItem,
	unequipItem,
} from "./equipment";
export type { Bonuses, EquipResult, Equipped } from "./equipment";
export { EQUIP_BEST_REMOTE, EQUIP_REMOTE, SELL_ITEM_REMOTE, UNEQUIP_REMOTE } from "./network";
export { PETS_ATTRIBUTE, decodePets, encodePets, followAlpha, petOffset } from "./pets";
export type { PetOffset } from "./pets";
export { countOfKind, groupInventory } from "./inventory-groups";
export type { ItemGroup } from "./inventory-groups";
