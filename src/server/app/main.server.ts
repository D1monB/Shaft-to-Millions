// Server bootstrap. Starts feature services in a fixed order:
// 1. Studio placeholders (so tagged objects exist before services look for them),
// 2. feature services (they register remotes and "profile loaded" listeners),
// 3. profile last, so every listener is in place before the first player's data loads.
import { startChestsService } from "server/features/chests";
import { startDevtoolsService } from "server/features/devtools";
import { startDrillService } from "server/features/drill";
import { startEquipmentService } from "server/features/equipment";
import { startLayersService } from "server/features/layers";
import { startLeaderboardService } from "server/features/leaderboard";
import { startMiningService } from "server/features/mining";
import { startMovementService } from "server/features/movement";
import { startProfileService } from "server/features/profile";
import { startSellingService } from "server/features/selling";
import { startTravelService } from "server/features/travel";
import { startUpgradesService } from "server/features/upgrades";
import { buildBasePlaceholders, buildChestPlaceholders, buildLayerPlaceholders } from "server/features/world";

buildBasePlaceholders();
buildLayerPlaceholders();
buildChestPlaceholders();

startMiningService();
startUpgradesService();
startSellingService();
startLayersService();
startMovementService();
startTravelService();
startDrillService();
startChestsService();
startEquipmentService();
startDevtoolsService();
startLeaderboardService();

startProfileService();
