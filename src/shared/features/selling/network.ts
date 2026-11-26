/** Client -> server: no arguments. Sells the whole bag. Must stand at a SellZone. */
export const SELL_BAG_REMOTE = "SellBag";

/** Server -> client: (money: number) a sale was paid; the client throws coins at the money counter. Visual only. */
export const SALE_MADE_REMOTE = "SaleMade";

/** How close (studs) the player must be to a SellZone. */
export const SELL_DISTANCE = 16;
