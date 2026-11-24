// Everything that can be stored in the warehouse and sold: ores and factory products under one id space.
import { ORES, ORE_IDS, OreId } from "./ores";
import { PRODUCTS, PRODUCT_IDS, ProductId } from "./products";

export type ResourceId = OreId | ProductId;

export interface ResourceDef {
	readonly name: string;
	readonly price: number;
}

export const RESOURCES: { readonly [K in ResourceId]: ResourceDef } = { ...ORES, ...PRODUCTS };

export const RESOURCE_IDS: ReadonlyArray<ResourceId> = [...ORE_IDS, ...PRODUCT_IDS];

export function isResourceId(value: unknown): value is ResourceId {
	return typeIs(value, "string") && (RESOURCES as Record<string, ResourceDef | undefined>)[value] !== undefined;
}
