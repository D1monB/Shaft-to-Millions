// Client bootstrap. Starts feature controllers (input, UI, effects only).
// The HUD starts first so other features can register their lines before the first data arrives;
// profile starts last so the first update reaches every registered listener.
import { startHudController } from "client/features/hud";
import { startMiningController } from "client/features/mining";
import { startProfileController } from "client/features/profile";
import { startShopController } from "client/features/upgrades";

startHudController();
startMiningController();
startShopController();

startProfileController();
