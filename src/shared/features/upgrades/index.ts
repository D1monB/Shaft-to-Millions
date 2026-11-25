// upgrades feature (shared): shop gear (pickaxes, bags, shoes) bought for money and materials, owned and equipped.
// Public API of this feature. Other code imports only from this file.
export {
	GEAR_BY_SLOT,
	GEAR_SLOTS,
	applyPurchase,
	createStarterGear,
	findGear,
	gearCardState,
	isGearSlot,
	materialList,
	missingMaterials,
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
	MaterialStock,
	MissingMaterial,
} from "./upgrades";
export { BUY_GEAR_REMOTE, EQUIP_GEAR_REMOTE, SHOP_DISTANCE } from "./network";
