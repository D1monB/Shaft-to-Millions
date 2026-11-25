// Puts an ore block on every ore spawn point of the map author's mine (decision 034): Map/Mine/OreSpawns/Tier<N>
// holds the points of layer N, and the deepest layer's points near the portal grow iridium. The blocks are plain
// coloured parts tagged OreNode (the same contract the mining service already uses) until the map author models
// ore blocks; they exist only while the server runs, the place file is never changed.
import { CollectionService, Workspace } from "@rbxts/services";
import { ATTRIBUTES, ORE_SPAWNS, PLOTS, TAGS } from "shared/config/map-contract";
import { ORES } from "shared/config/ores";
import { oreForSpawn, tierOf } from "shared/features/mining";

/** Edge of one ore block (studs). Matches the Studio placeholders, so mining distances feel the same. */
const NODE_SIZE = 4;

function flatDistance(a: Vector3, b: Vector3): number {
	return new Vector2(a.X - b.X, a.Z - b.Z).Magnitude;
}

function makeNode(spawn: BasePart, oreId: keyof typeof ORES, parent: Instance): void {
	const [r, g, b] = ORES[oreId].color;
	const node = new Instance("Part");
	node.Name = `Ore_${oreId}`;
	node.Anchored = true;
	node.Size = new Vector3(NODE_SIZE, NODE_SIZE, NODE_SIZE);
	node.Color = Color3.fromRGB(r, g, b);
	node.Material = Enum.Material.Slate;
	node.TopSurface = Enum.SurfaceType.Smooth;
	node.BottomSurface = Enum.SurfaceType.Smooth;
	// The block stands on the floor the point stands on: their bottoms line up.
	const lift = (NODE_SIZE - spawn.Size.Y) / 2;
	node.CFrame = spawn.CFrame.add(new Vector3(0, lift, 0));
	node.SetAttribute(ATTRIBUTES.OreId, oreId);
	node.Parent = parent;
	CollectionService.AddTag(node, TAGS.OreNode);
}

/** Builds the ore blocks; returns how many. Run before the mining service starts (it also picks up later ones). */
export function spawnMapOre(): number {
	const mine = Workspace.FindFirstChild(PLOTS.MapFolder)?.FindFirstChild(ORE_SPAWNS.Mine);
	const spawns = mine?.FindFirstChild(ORE_SPAWNS.Spawns);
	if (spawns === undefined) {
		return 0;
	}
	const portal = mine?.FindFirstChild(ORE_SPAWNS.PortalModel)?.FindFirstChild(ORE_SPAWNS.Portal);
	const portalPosition = portal !== undefined && portal.IsA("BasePart") ? portal.Position : undefined;
	const folder = new Instance("Folder");
	folder.Name = "MapOre";
	let count = 0;
	for (const tierFolder of spawns.GetChildren()) {
		const tier = tierOf(tierFolder.Name);
		if (tier === undefined) {
			continue;
		}
		for (const spawn of tierFolder.GetChildren()) {
			if (!spawn.IsA("BasePart")) {
				continue;
			}
			const distance = portalPosition !== undefined ? flatDistance(spawn.Position, portalPosition) : undefined;
			const oreId = oreForSpawn(tier, distance);
			if (oreId !== undefined) {
				makeNode(spawn, oreId, folder);
				count += 1;
			}
		}
	}
	folder.Parent = Workspace;
	return count;
}
