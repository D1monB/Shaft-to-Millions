// Collectible items from chests: pets (sell bonus), speed auras (walk speed) and pickaxe auras (ore yield).
// Bonuses are fractions: 0.1 = +10%. Names are our own.

export type ItemKind = "pet" | "speedAura" | "pickaxeAura";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ItemId =
	| "pet_mole"
	| "pet_beetle"
	| "pet_moth"
	| "pet_lizard"
	| "pet_golem"
	| "aura_breeze"
	| "aura_spark"
	| "aura_comet"
	| "aura_lightning"
	| "aura_storm"
	| "paura_glint"
	| "paura_ember"
	| "paura_quake"
	| "paura_prism"
	| "paura_core";

export interface ItemDef {
	readonly name: string;
	readonly kind: ItemKind;
	readonly rarity: Rarity;
	readonly bonus: number;
}

export const ITEMS: { readonly [K in ItemId]: ItemDef } = {
	pet_mole: { name: "Кротик", kind: "pet", rarity: "common", bonus: 0.05 },
	pet_beetle: { name: "Рудний жук", kind: "pet", rarity: "uncommon", bonus: 0.1 },
	pet_moth: { name: "Ліхтарна міль", kind: "pet", rarity: "rare", bonus: 0.18 },
	pet_lizard: { name: "Кришталева ящірка", kind: "pet", rarity: "epic", bonus: 0.3 },
	pet_golem: { name: "Золотий голем", kind: "pet", rarity: "legendary", bonus: 0.5 },

	aura_breeze: { name: "Подих вітру", kind: "speedAura", rarity: "common", bonus: 0.05 },
	aura_spark: { name: "Іскра", kind: "speedAura", rarity: "uncommon", bonus: 0.1 },
	aura_comet: { name: "Комета", kind: "speedAura", rarity: "rare", bonus: 0.15 },
	aura_lightning: { name: "Блискавка", kind: "speedAura", rarity: "epic", bonus: 0.22 },
	aura_storm: { name: "Буревій", kind: "speedAura", rarity: "legendary", bonus: 0.3 },

	paura_glint: { name: "Відблиск", kind: "pickaxeAura", rarity: "common", bonus: 0.1 },
	paura_ember: { name: "Жар", kind: "pickaxeAura", rarity: "uncommon", bonus: 0.2 },
	paura_quake: { name: "Поштовх", kind: "pickaxeAura", rarity: "rare", bonus: 0.35 },
	paura_prism: { name: "Призма", kind: "pickaxeAura", rarity: "epic", bonus: 0.55 },
	paura_core: { name: "Ядро", kind: "pickaxeAura", rarity: "legendary", bonus: 0.8 },
};

export const RARITY_NAMES: { readonly [K in Rarity]: string } = {
	common: "Звичайний",
	uncommon: "Незвичайний",
	rare: "Рідкісний",
	epic: "Епічний",
	legendary: "Легендарний",
};

/** RGB per rarity, as plain numbers so this file runs in headless tests. */
export const RARITY_COLORS: { readonly [K in Rarity]: readonly [number, number, number] } = {
	common: [190, 190, 190],
	uncommon: [90, 200, 120],
	rare: [80, 150, 255],
	epic: [180, 90, 240],
	legendary: [255, 190, 50],
};

export const KIND_NAMES: { readonly [K in ItemKind]: string } = {
	pet: "Улюбленець",
	speedAura: "Аура швидкості",
	pickaxeAura: "Аура кирки",
};

export function isItemId(value: unknown): value is ItemId {
	return typeIs(value, "string") && (ITEMS as Record<string, ItemDef | undefined>)[value] !== undefined;
}

/** Max items a player can own. Keeps the save small; chests refuse to open when it is full. */
export const INVENTORY_LIMIT = 60;
/**
 * Robux purchases are never refused for a full inventory (the money is already spent),
 * so they may go a little over the limit. The save is hard-capped here.
 */
export const INVENTORY_HARD_LIMIT = 80;
