// Factory machines and their recipes. A new machine or recipe is a new entry here, not new code.
// Coal is fuel for smelting everything except copper, which melts easily: an early reason to keep coal.
import { ResourceId } from "./resources";

export type MachineId = "furnace" | "workbench";
export type RecipeId =
	| "smelt_copper"
	| "smelt_iron"
	| "smelt_silver"
	| "smelt_gold"
	| "make_wire"
	| "make_gear"
	| "make_contact"
	| "make_circuit";

export type ResourceAmounts = { readonly [K in ResourceId]?: number };

export interface RecipeDef {
	readonly machine: MachineId;
	readonly inputs: ResourceAmounts;
	readonly outputs: ResourceAmounts;
	readonly seconds: number;
}

export interface MachineDef {
	readonly name: string;
	readonly description: string;
	readonly price: number;
	/** Max crafts waiting in the queue (including the one in progress). */
	readonly queueLimit: number;
}

export const MACHINES: { readonly [K in MachineId]: MachineDef } = {
	furnace: {
		name: "Горн",
		description: "Переплавляє руду на злитки. Злиток дорожчий за руду, з якої зроблений.",
		price: 500,
		queueLimit: 10,
	},
	workbench: {
		name: "Верстат",
		description: "Робить зі злитків деталі. Найдорожчий товар на ринку.",
		price: 3_000,
		queueLimit: 10,
	},
};

export const MACHINE_IDS: ReadonlyArray<MachineId> = ["furnace", "workbench"];

export const RECIPES: { readonly [K in RecipeId]: RecipeDef } = {
	smelt_copper: { machine: "furnace", inputs: { copper: 3 }, outputs: { copper_ingot: 1 }, seconds: 6 },
	smelt_iron: { machine: "furnace", inputs: { iron: 2, coal: 1 }, outputs: { iron_ingot: 1 }, seconds: 8 },
	smelt_silver: { machine: "furnace", inputs: { silver: 2, coal: 1 }, outputs: { silver_ingot: 1 }, seconds: 10 },
	smelt_gold: { machine: "furnace", inputs: { gold: 2, coal: 1 }, outputs: { gold_ingot: 1 }, seconds: 12 },
	make_wire: { machine: "workbench", inputs: { copper_ingot: 2 }, outputs: { copper_wire: 1 }, seconds: 10 },
	make_gear: { machine: "workbench", inputs: { iron_ingot: 2 }, outputs: { iron_gear: 1 }, seconds: 12 },
	make_contact: {
		machine: "workbench",
		inputs: { silver_ingot: 1, copper_wire: 1 },
		outputs: { silver_contact: 1 },
		seconds: 15,
	},
	make_circuit: {
		machine: "workbench",
		inputs: { gold_ingot: 1, copper_wire: 2, quartz: 1 },
		outputs: { gold_circuit: 1 },
		seconds: 20,
	},
};

export const RECIPE_IDS: ReadonlyArray<RecipeId> = [
	"smelt_copper",
	"smelt_iron",
	"smelt_silver",
	"smelt_gold",
	"make_wire",
	"make_gear",
	"make_contact",
	"make_circuit",
];

export function isMachineId(value: unknown): value is MachineId {
	return typeIs(value, "string") && (MACHINES as Record<string, MachineDef | undefined>)[value] !== undefined;
}

export function isRecipeId(value: unknown): value is RecipeId {
	return typeIs(value, "string") && (RECIPES as Record<string, RecipeDef | undefined>)[value] !== undefined;
}

export function recipesOf(machine: MachineId): RecipeId[] {
	return RECIPE_IDS.filter((id) => RECIPES[id].machine === machine);
}

/** Warehouse capacity (all resources together). Kept modest so selling and processing both matter. */
export const WAREHOUSE_CAPACITY = 1_000;
