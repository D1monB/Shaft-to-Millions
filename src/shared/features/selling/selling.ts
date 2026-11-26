// Pure sale math. The preview the player sees and the sale the server makes use the SAME function,
// so the number on the button is exactly the money received (unless the bag changed in between).

export interface PriceEntry {
	readonly price: number;
}

export interface SaleLine {
	readonly id: string;
	readonly count: number;
	readonly unitPrice: number;
	readonly subtotal: number;
}

export interface SalePreview {
	readonly lines: ReadonlyArray<SaleLine>;
	readonly itemCount: number;
	readonly baseTotal: number;
	readonly multiplier: number;
	/** What the player receives: floor(baseTotal * multiplier). */
	readonly total: number;
}

/** Highest sell multiplier we ever apply, whatever the bonuses say. Protects the economy from data bugs. */
export const MAX_SELL_MULTIPLIER = 7;

export function safeMultiplier(multiplier: number): number {
	if (multiplier !== multiplier || multiplier < 1) {
		return 1;
	}
	return math.min(multiplier, MAX_SELL_MULTIPLIER);
}

/**
 * Prices `counts` using `prices`, in the order of `ids`. Unknown ids, zero and bad counts are skipped.
 * Taking the id order and price table as parameters lets the same code price ore and factory products.
 */
export function previewSale(
	counts: { readonly [id: string]: number | undefined },
	ids: ReadonlyArray<string>,
	prices: { readonly [id: string]: PriceEntry | undefined },
	multiplier: number,
): SalePreview {
	const lines: SaleLine[] = [];
	let itemCount = 0;
	let baseTotal = 0;
	for (const id of ids) {
		const raw = counts[id];
		const entry = prices[id];
		if (raw === undefined || entry === undefined || !(raw > 0) || raw === math.huge) {
			continue;
		}
		const count = math.floor(raw);
		const subtotal = count * entry.price;
		lines.push({ id, count, unitPrice: entry.price, subtotal });
		itemCount += count;
		baseTotal += subtotal;
	}
	const safe = safeMultiplier(multiplier);
	return { lines, itemCount, baseTotal, multiplier: safe, total: math.floor(baseTotal * safe) };
}
