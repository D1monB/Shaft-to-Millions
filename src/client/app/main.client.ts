// Client bootstrap. Starts feature controllers (input, UI, effects only).
// The HUD starts first so other features can register their lines before the first data arrives;
// profile starts last so the first update reaches every registered listener.
import { startChestsController } from "client/features/chests";
import { startDrillController } from "client/features/drill";
import { startEquipmentController } from "client/features/equipment";
import { startFactoryController } from "client/features/factory";
import { startGoalsController } from "client/features/goals";
import { startHudController } from "client/features/hud";
import { startMiningController } from "client/features/mining";
import { startProfileController } from "client/features/profile";
import { startSellController } from "client/features/selling";
import { startShopController } from "client/features/upgrades";

startHudController();
startMiningController();
startShopController();
startSellController();
startGoalsController();
startFactoryController();
startDrillController();
startChestsController();
startEquipmentController();

startProfileController();
