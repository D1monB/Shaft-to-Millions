// Tags and attributes that connect the map (built in Studio by the map author) to the code.
// Single source of truth for docs/map-contract.md: change both together.

export const TAGS = {
	/** A minable block. Attribute OreId. */
	OreNode: "OreNode",
	/** Upgrade shop (pickaxe, bag, shoes). */
	Shop: "Shop",
	/** Where the bag is sold. */
	SellZone: "SellZone",
	/** Respawn point and progress checkpoint of a layer. Attribute LayerId. */
	CampSpawn: "CampSpawn",
	/** Where fast travel to the surface puts the player. One Part is enough. */
	SurfaceSpawn: "SurfaceSpawn",
	/** Where an auto drill can be built. Attribute LayerId. */
	DrillSite: "DrillSite",
	/** A chest stand. Attribute ChestId. */
	Chest: "Chest",
} as const;

export const ATTRIBUTES = {
	OreId: "OreId",
	LayerId: "LayerId",
	ChestId: "ChestId",
	/** On an ore block: true for a rich vein (decision 046). Set by the server only. */
	Rich: "Rich",
} as const;

/**
 * The tycoon plots (decisions 027), found by path, not by tag, because the map author built them that way:
 * Workspace/Map/Plots/<PlotN> (Model, attributes Owner, PlotIndex) with a Base part and
 * Factory/Machines/<model with attribute Stage 1..12> and Factory/Conveyors/<parts with ConveyorFlow>.
 * A plot without a Factory gets a copy of the first plot's Factory at runtime (the map is not changed).
 */
export const PLOTS = {
	MapFolder: "Map",
	PlotsFolder: "Plots",
	Base: "Base",
	Factory: "Factory",
	Machines: "Machines",
	Conveyors: "Conveyors",
} as const;

/**
 * The chest terminals the map author put on every plot: Map/Plots/<PlotN>/Terminals/<name>, each with an Attachment
 * PromptPoint (fallback RollButton) somewhere inside. The server turns them into Chest stands at runtime.
 */
export const CHEST_TERMINALS = {
	Folder: "Terminals",
	PromptPoint: "PromptPoint",
	FallbackPoint: "RollButton",
	/** The name sign of a terminal (a Part with a SurfaceGui). */
	Title: "TitleText",
	/** ParticleEmitter (Rate 0) that bursts when a roll comes out. */
	Burst: "RollBurst",
	/** Terminal model name -> chest id (config/chests.ts). */
	Chests: {
		Terminal_Pets: "pet_chest",
		Terminal_PickaxeAura: "pickaxe_chest",
		Terminal_CharAura: "speed_chest",
	},
} as const;

/**
 * The booth at the start of each plot's belt (decision 039): ServerStorage/LineTemplates/IntakeBooth, a Model whose
 * pivot is where the belt starts, facing the way items ride. Optional: a plain booth stands in while it is missing.
 */
export const INTAKE_BOOTH = {
	TemplateFolder: "LineTemplates",
	Model: "IntakeBooth",
} as const;

/**
 * The lift (decision 040): Workspace/Map/Mine/Decor/LiftTower holds the cage Model and the tower Model. Optional
 * BaseParts LiftTop / LiftBottom in the same folder mark where the cage's floor stops (LiftBottom may carry a number
 * attribute Layer: riding down needs that layer opened). Without them the cage rides from where it stands to the top
 * of the tower.
 */
export const LIFT = {
	Path: ["Map", "Mine", "Decor", "LiftTower"],
	Cage: "Lift_Cage",
	Tower: "Lift_Tower",
	Top: "LiftTop",
	Bottom: "LiftBottom",
	LayerAttribute: "Layer",
} as const;

/**
 * The SellStation at the end of each plot's belt (decision 044): Factory/SellStation with the map author's boards.
 * Paths go from the station; "SurfaceGui" is searched at any depth below the part named before it.
 */
export const SELL_STATION = {
	Model: "SellStation",
	SignTitle: ["SignText", "SurfaceGui", "Title"],
	PriceTitle: ["PriceScreen", "SurfaceGui", "PriceList", "Title"],
	PriceOre: ["PriceScreen", "SurfaceGui", "PriceList", "Ore"],
	PriceIngot: ["PriceScreen", "SurfaceGui", "PriceList", "Ingot"],
	PricePart: ["PriceScreen", "SurfaceGui", "PriceList", "Part"],
	ButtonLabel: ["ButtonText", "SurfaceGui", "Label"],
} as const;

/** The name board over each plot: Map/Plots/<PlotN>/Sign with a TextLabel OwnerName inside (any depth). */
export const PLOT_SIGN = {
	Part: "Sign",
	Label: "OwnerName",
} as const;

export const PLOT_ATTRIBUTES = {
	/** On the plot: UserId of the owner, 0 = free. Set by the server. */
	Owner: "Owner",
	PlotIndex: "PlotIndex",
	/** On a machine model: its place in the line, 1..12 (LINE_MACHINES order). */
	Stage: "Stage",
	/** On a machine model: the owner has bought it. Set by the server, read by the client for visuals. */
	Bought: "Bought",
	/** On a conveyor part: false stops the belt animation (read by the map author's ConveyorAnimator). */
	ConveyorOn: "ConveyorOn",
	ConveyorFlow: "ConveyorFlow",
} as const;

/**
 * The map author's ore spawn points (decision 034): Workspace/Map/Mine/OreSpawns/Tier<N>/<any BasePart>, Tier N =
 * layer N. The server puts an ore block on every point at start; points near Mine/TunnelEntrance/Portal on the
 * deepest layer grow iridium. The place file is not changed.
 */
export const ORE_SPAWNS = {
	Mine: "Mine",
	Spawns: "OreSpawns",
	PortalModel: "TunnelEntrance",
	Portal: "Portal",
} as const;
