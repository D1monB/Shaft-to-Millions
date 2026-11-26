/** Client -> server: (itemId: string). Must stand at a Shop. Buys the item and equips it. */
export const BUY_GEAR_REMOTE = "BuyGear";

/** Client -> server: (itemId: string). Equips an owned item. Works anywhere: it only switches between own things. */
export const EQUIP_GEAR_REMOTE = "EquipGear";

/** How close (studs) the player must be to a Shop to buy. */
export const SHOP_DISTANCE = 16;

/** Folder of the map author's pickaxe Tools: ServerStorage (originals) and ReplicatedStorage (copies for the hotbar). */
export const PICKAXE_TEMPLATES_FOLDER = "PickaxeTemplates";

/** On a pickaxe Tool the server handed out: the pickaxe id (config/pickaxes.ts). */
export const PICKAXE_ID_ATTRIBUTE = "PickaxeId";
