// Client bootstrap. Starts feature controllers (input, UI, effects only), then mounts the React UI.
// Controllers register HUD stats, menu buttons and goal sources, so they all start before the UI mounts;
// profile starts last so the first server update reaches every listener.
import { startChestsController } from "client/features/chests";
import { startDevtoolsController } from "client/features/devtools";
import { startDrillController } from "client/features/drill";
import { startEquipmentController } from "client/features/equipment";
import { startGoalsController } from "client/features/goals";
import { startI18nController } from "client/features/i18n";
import { startLeaderboardController } from "client/features/leaderboard";
import { startLineController } from "client/features/line";
import { startMiningController } from "client/features/mining";
import { startPetsController } from "client/features/pets";
import { startProfileController } from "client/features/profile";
import { startQuestsController } from "client/features/quests";
import { startStoreController } from "client/features/store";
import { startBaseController } from "client/features/base";
import { startAuraRollController } from "client/features/aura-roll";
import { startSellController } from "client/features/selling";
import { startSoundController } from "client/features/settings";
import { startTravelController } from "client/features/travel";
import { startShopController } from "client/features/upgrades";
import { mountUi } from "./ui-root";

// Language first: every later controller and the UI read their words from it.
startI18nController();
startMiningController();
startShopController();
startSellController();
startGoalsController();
startDrillController();
startTravelController();
startLeaderboardController();
startChestsController();
startEquipmentController();
startPetsController();
startDevtoolsController();
startLineController();
startSoundController();
startQuestsController();
startStoreController();
startBaseController();
startAuraRollController();

mountUi();
startProfileController();
