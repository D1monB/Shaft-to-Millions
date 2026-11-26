// Pure store rules (decision 057): which products a player may buy and how much money a pack gives.
import { MONEY_PACK_LAYER_GROWTH, STORE_PRODUCTS, StoreProduct } from "shared/config/store";
import { isFiniteNumber } from "shared/lib/validate";

export function productById(productId: number): StoreProduct | undefined {
	return STORE_PRODUCTS.find((product) => product.productId !== undefined && product.productId === productId);
}

/** A crystal pack needs paid random items to be allowed for the buyer (crystals open chests). */
export function needsRandomPolicy(product: StoreProduct): boolean {
	return product.grant.kind === "crystals";
}

/** Products shown to this player: created on the dashboard, and allowed by their policy. */
export function visibleProducts(randomAllowed: boolean): StoreProduct[] {
	return STORE_PRODUCTS.filter(
		(product) => product.productId !== undefined && (randomAllowed || !needsRandomPolicy(product)),
	);
}

/** Money a pack gives a player whose deepest layer is `layer`; a broken layer counts as layer 1. */
export function moneyPackAmount(base: number, layer: number): number {
	const steps = isFiniteNumber(layer) ? math.clamp(math.floor(layer), 1, 20) - 1 : 0;
	return math.floor(base * math.pow(MONEY_PACK_LAYER_GROWTH, steps));
}
