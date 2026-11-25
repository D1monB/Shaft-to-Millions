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
} as const;
