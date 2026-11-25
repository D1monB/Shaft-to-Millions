// Pickaxes. The first one is what every player starts with. The main line is ordered from weak to strong;
// side items (with `special`) trade one strength for another.
// `tier` decides WHICH ore can be mined (ores.ts requiredTier); `power` and `swingSeconds` decide HOW FAST.
import type { GearBase } from "./gear";

export interface PickaxeDef extends GearBase {
	readonly tier: number;
	/** Damage per hit. */
	readonly power: number;
	/** Minimum seconds between hits. The server enforces it, the client only animates it. */
	readonly swingSeconds: number;
}

export const PICKAXES: ReadonlyArray<PickaxeDef> = [
	{ id: "pickaxe_wood", name: "Дерев'яна кирка", tier: 1, power: 1, swingSeconds: 0.55, price: 0, materials: {} },
	{ id: "pickaxe_stone", name: "Кам'яна кирка", tier: 1, power: 2, swingSeconds: 0.55, price: 60, materials: {} },
	{
		id: "pickaxe_copper",
		name: "Мідна кирка",
		tier: 1,
		power: 2,
		swingSeconds: 0.45,
		price: 200,
		materials: { copper_ingot: 5 },
	},
	{
		id: "pickaxe_iron",
		name: "Залізна кирка",
		tier: 2,
		power: 3,
		swingSeconds: 0.45,
		price: 600,
		materials: { iron_ingot: 8 },
	},
	{
		id: "pickaxe_light",
		name: "Легка кирка",
		tier: 2,
		power: 2,
		swingSeconds: 0.25,
		price: 1_500,
		materials: { copper_wire: 5 },
		special: "Дуже швидка, але слабка: найкраща для м'якої руди",
	},
	{
		id: "pickaxe_silver",
		name: "Срібна кирка",
		tier: 2,
		power: 4,
		swingSeconds: 0.4,
		price: 2_500,
		materials: { silver_ingot: 10 },
	},
	{
		id: "pickaxe_gold",
		name: "Золота кирка",
		tier: 3,
		power: 5,
		swingSeconds: 0.4,
		price: 8_000,
		materials: { gold_ingot: 10 },
	},
	{
		id: "pickaxe_hammer",
		name: "Кирка-молот",
		tier: 3,
		power: 12,
		swingSeconds: 0.9,
		price: 15_000,
		materials: { iron_ingot: 15 },
		special: "Повільна, але тверду руду ламає з одного удару",
	},
	{
		id: "pickaxe_obsidian",
		name: "Обсидіанова кирка",
		tier: 3,
		power: 7,
		swingSeconds: 0.35,
		price: 25_000,
		materials: { obsidian: 20 },
	},
	{
		id: "pickaxe_cobalt",
		name: "Кобальтова кирка",
		tier: 4,
		power: 9,
		swingSeconds: 0.35,
		price: 80_000,
		// Not cobalt ore: that needs a tier 4 pickaxe, so the item could never be bought before the drill.
		materials: { obsidian: 25, gold_ingot: 10 },
	},
	{
		id: "pickaxe_drill",
		name: "Ручний бур",
		tier: 4,
		power: 12,
		swingSeconds: 0.3,
		price: 200_000,
		materials: { iron_gear: 20 },
	},
	{
		id: "pickaxe_plasma",
		name: "Плазмовий бур",
		tier: 5,
		power: 16,
		swingSeconds: 0.3,
		price: 600_000,
		materials: { gold_circuit: 10 },
	},
];
