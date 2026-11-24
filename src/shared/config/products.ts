// Factory products. Each step of processing is worth more than its inputs, but costs time:
// the player chooses between quick cash (sell ore) and more money later (process it).

export type ProductId =
	| "copper_ingot"
	| "iron_ingot"
	| "silver_ingot"
	| "gold_ingot"
	| "copper_wire"
	| "iron_gear"
	| "silver_contact"
	| "gold_circuit";

export interface ProductDef {
	readonly name: string;
	readonly price: number;
}

export const PRODUCTS: { readonly [K in ProductId]: ProductDef } = {
	copper_ingot: { name: "Мідний злиток", price: 24 },
	iron_ingot: { name: "Залізний злиток", price: 32 },
	silver_ingot: { name: "Срібний злиток", price: 65 },
	gold_ingot: { name: "Золотий злиток", price: 140 },
	copper_wire: { name: "Мідний дріт", price: 80 },
	iron_gear: { name: "Залізна шестерня", price: 105 },
	silver_contact: { name: "Срібний контакт", price: 230 },
	gold_circuit: { name: "Золота плата", price: 520 },
};

export const PRODUCT_IDS: ReadonlyArray<ProductId> = [
	"copper_ingot",
	"iron_ingot",
	"silver_ingot",
	"gold_ingot",
	"copper_wire",
	"iron_gear",
	"silver_contact",
	"gold_circuit",
];
