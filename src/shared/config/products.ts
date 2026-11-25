// Factory products. Each step of processing is worth more than its inputs, but costs time.
// Temporary: the recipe factory is replaced by the tycoon line (decisions 027).

export type ProductId = "copper_ingot" | "iron_ingot" | "gold_ingot" | "copper_wire" | "iron_gear" | "gold_circuit";

export interface ProductDef {
	readonly name: string;
	readonly price: number;
}

export const PRODUCTS: { readonly [K in ProductId]: ProductDef } = {
	copper_ingot: { name: "Мідний злиток", price: 24 },
	iron_ingot: { name: "Залізний злиток", price: 32 },
	gold_ingot: { name: "Золотий злиток", price: 140 },
	copper_wire: { name: "Мідний дріт", price: 80 },
	iron_gear: { name: "Залізна шестерня", price: 105 },
	gold_circuit: { name: "Золота плата", price: 520 },
};

export const PRODUCT_IDS: ReadonlyArray<ProductId> = [
	"copper_ingot",
	"iron_ingot",
	"gold_ingot",
	"copper_wire",
	"iron_gear",
	"gold_circuit",
];
