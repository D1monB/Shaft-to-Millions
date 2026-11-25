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
}

export const MACHINES: { readonly [K in MachineId]: MachineDef } = {
	furnace: {
		name: "Горн",
		description: "Переплавляє руду на злитки. Злиток дорожчий за руду, з якої зроблений.",
		price: 400,
	},
	workbench: {
		name: "Верстат",
		description: "Робить зі злитків деталі. Найдорожчий товар на ринку.",
		price: 3_000,
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

/** One step of an upgrade track. Level 1 is the base (price 0); buying level N costs `levels[N - 1].price`. */
export interface UpgradeLevel {
	readonly price: number;
	/** What the level gives: a speed multiplier, a queue size or a warehouse capacity (see the table using it). */
	readonly value: number;
}

export type UpgradeTrack = "speed" | "queue";

/**
 * Machine upgrades. Speed: value = how many times faster crafts run. Queue: value = max crafts waiting in the queue
 * (including the one in progress). Prices are first guesses to be tuned after the first play-test (docs/balance-tuning.md).
 */
export const MACHINE_UPGRADES: {
	readonly [K in MachineId]: {
		readonly speed: ReadonlyArray<UpgradeLevel>;
		readonly queue: ReadonlyArray<UpgradeLevel>;
	};
} = {
	furnace: {
		speed: [
			{ price: 0, value: 1 },
			{ price: 1_500, value: 1.25 },
			{ price: 6_000, value: 1.6 },
			{ price: 25_000, value: 2 },
		],
		queue: [
			{ price: 0, value: 10 },
			{ price: 1_000, value: 15 },
			{ price: 4_000, value: 20 },
			{ price: 15_000, value: 30 },
		],
	},
	workbench: {
		speed: [
			{ price: 0, value: 1 },
			{ price: 8_000, value: 1.25 },
			{ price: 30_000, value: 1.6 },
			{ price: 120_000, value: 2 },
		],
		queue: [
			{ price: 0, value: 10 },
			{ price: 5_000, value: 15 },
			{ price: 20_000, value: 20 },
			{ price: 80_000, value: 30 },
		],
	},
};

/**
 * Warehouse capacity per level (all resources together). Level 1 is kept modest so selling and processing both matter;
 * upgrades let a player who invests in the factory keep more stock.
 */
export const WAREHOUSE_LEVELS: ReadonlyArray<UpgradeLevel> = [
	{ price: 0, value: 1_000 },
	{ price: 2_000, value: 2_000 },
	{ price: 10_000, value: 4_000 },
	{ price: 50_000, value: 8_000 },
];

export function isUpgradeTrack(value: unknown): value is UpgradeTrack {
	return value === "speed" || value === "queue";
}
