// Client bootstrap. Starts feature controllers (input, UI, effects only), then mounts the React UI.
// Controllers register HUD stats, menu buttons and goal sources, so they all start before the UI mounts;
// profile starts last so the first server update reaches every listener.
import { startChestsController } from "client/features/chests";
import { startDevtoolsController } from "client/features/devtools";
import { startDrillController } from "client/features/drill";
import { startEquipmentController } from "client/features/equipment";
import { startFactoryController } from "client/features/factory";
import { startGoalsController } from "client/features/goals";
import { startMiningController } from "client/features/mining";
import { startProfileController } from "client/features/profile";
import { startSellController } from "client/features/selling";
import { startTravelController } from "client/features/travel";
import { startShopController } from "client/features/upgrades";
import { mountUi } from "./ui-root";

startMiningController();
startShopController();
startSellController();
startGoalsController();
startFactoryController();
startDrillController();
startTravelController();
startChestsController();
startEquipmentController();
startDevtoolsController();

mountUi();
startProfileController();
