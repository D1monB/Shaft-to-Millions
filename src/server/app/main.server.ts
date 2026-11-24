// Server bootstrap. Starts feature services in a fixed order:
// 1. Studio placeholders (so tagged objects exist before services look for them),
// 2. feature services (they register remotes and "profile loaded" listeners),
// 3. profile last, so every listener is in place before the first player's data loads.
import { startDrillService } from "server/features/drill";
import { startFactoryService } from "server/features/factory";
import { startLayersService } from "server/features/layers";
import { startMiningService } from "server/features/mining";
import { startMovementService } from "server/features/movement";
import { startProfileService } from "server/features/profile";
import { startSellingService } from "server/features/selling";
import { startUpgradesService } from "server/features/upgrades";
import { buildBasePlaceholders, buildFactoryPlaceholders, buildLayerPlaceholders } from "server/features/world";

buildBasePlaceholders();
buildFactoryPlaceholders();
buildLayerPlaceholders();

startMiningService();
startUpgradesService();
startSellingService();
startFactoryService();
startLayersService();
startMovementService();
startDrillService();

startProfileService();
