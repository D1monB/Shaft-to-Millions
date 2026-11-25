// Pickaxes. The first one is what every player starts with. The main line is ordered from weak to strong;
// side items (with `special`) trade one strength for another.
// `tier` decides WHICH ore can be mined (ores.ts requiredTier); `power` and `swingSeconds` decide HOW FAST.
// Ids are saved in profiles and never change; some display names changed with the new ores (decisions 027).
import type { GearBase } from "./gear";

export interface PickaxeDef extends GearBase {
	readonly tier: number;
	/** Damage per hit. */
	readonly power: number;
	/** Minimum seconds between hits. The server enforces it, the client only animates it. */
	readonly swingSeconds: number;
}

export const PICKAXES: ReadonlyArray<PickaxeDef> = [
	{ id: "pickaxe_wood", name: "Дерев'яна кирка", tier: 1, power: 1, swingSeconds: 0.55, price: 0 },
	{ id: "pickaxe_stone", name: "Кам'яна кирка", tier: 1, power: 2, swingSeconds: 0.55, price: 60 },
	{ id: "pickaxe_copper", name: "Мідна кирка", tier: 2, power: 2, swingSeconds: 0.45, price: 250 },
	{ id: "pickaxe_iron", name: "Залізна кирка", tier: 2, power: 3, swingSeconds: 0.45, price: 900 },
	{
		id: "pickaxe_light",
		name: "Легка кирка",
		tier: 2,
		power: 2,
		swingSeconds: 0.25,
		price: 2_000,
		special: "Дуже швидка, але слабка: найкраща для м'якої руди",
	},
	{ id: "pickaxe_silver", name: "Сталева кирка", tier: 3, power: 4, swingSeconds: 0.4, price: 4_000 },
	{ id: "pickaxe_gold", name: "Срібна кирка", tier: 3, power: 5, swingSeconds: 0.4, price: 12_000 },
	{
		id: "pickaxe_hammer",
		name: "Кирка-молот",
		tier: 4,
		power: 12,
		swingSeconds: 0.9,
		price: 30_000,
		special: "Повільна, але тверду руду ламає з одного удару",
	},
	{ id: "pickaxe_obsidian", name: "Золота кирка", tier: 4, power: 7, swingSeconds: 0.35, price: 60_000 },
	{ id: "pickaxe_cobalt", name: "Титанова кирка", tier: 5, power: 9, swingSeconds: 0.35, price: 200_000 },
	{ id: "pickaxe_drill", name: "Ручний бур", tier: 5, power: 12, swingSeconds: 0.3, price: 600_000 },
	{ id: "pickaxe_plasma", name: "Плазмовий бур", tier: 5, power: 16, swingSeconds: 0.3, price: 2_000_000 },
];
