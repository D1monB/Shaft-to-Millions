// upgrades feature (shared): shop gear (pickaxes, bags, shoes) bought for money, owned and equipped.
// Public API of this feature. Other code imports only from this file.
export {
	GEAR_BY_SLOT,
	GEAR_SLOTS,
	applyPurchase,
	createStarterGear,
	findGear,
	gearCardState,
	isGearSlot,
	nextGearToBuy,
	starterOf,
	tryBuyGear,
	tryEquipGear,
} from "./upgrades";
export type {
	BuyGearResult,
	EquipGearResult,
	EquippedGear,
	FoundGear,
	GearCardState,
	GearSlot,
	GearState,
} from "./upgrades";
export { shopSells, shopSlotOf } from "./shops";
export type { ShopSlot } from "./shops";
export {
	BUY_GEAR_REMOTE,
	EQUIP_GEAR_REMOTE,
	PICKAXE_ID_ATTRIBUTE,
	PICKAXE_TEMPLATES_FOLDER,
	SHOP_DISTANCE,
} from "./network";
