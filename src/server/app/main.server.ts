// Server bootstrap. Starts feature services in a fixed order:
// 1. Studio placeholders (so tagged objects exist before services look for them),
// 2. feature services (they register remotes and "profile loaded" listeners),
// 3. profile last, so every listener is in place before the first player's data loads.
import { setupChestTerminals, startChestsService } from "server/features/chests";
import { startDevtoolsService } from "server/features/devtools";
import { startDrillService } from "server/features/drill";
import { startEquipmentService } from "server/features/equipment";
import { startLanguageService } from "server/features/i18n";
import { startLayersService } from "server/features/layers";
import { startLeaderboardService } from "server/features/leaderboard";
import { startLiftService } from "server/features/lift";
import { startLineService } from "server/features/line";
import { startMiningService } from "server/features/mining";
import { startMovementService } from "server/features/movement";
import { startProfileService } from "server/features/profile";
import { startSellingService } from "server/features/selling";
import { startTravelService } from "server/features/travel";
import { startUpgradesService } from "server/features/upgrades";
import {
	buildBasePlaceholders,
	buildChestPlaceholders,
	buildLayerPlaceholders,
	buildPlotPlaceholders,
	spawnMapOre,
} from "server/features/world";

// The map author's ore spawn points first: with real ore on the map, no ore placeholders are built.
spawnMapOre();
buildBasePlaceholders();
buildLayerPlaceholders();
// The map author's chest terminals first: with real Chest stands on the map, no chest placeholders are built.
setupChestTerminals();
buildChestPlaceholders();
buildPlotPlaceholders();

startMiningService();
startUpgradesService();
startSellingService();
startLayersService();
startMovementService();
startTravelService();
startLiftService();
startDrillService();
startLineService();
startChestsService();
startEquipmentService();
startDevtoolsService();
startLeaderboardService();
startLanguageService();

startProfileService();
