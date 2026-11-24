// Client bootstrap. Starts feature controllers (input, UI, effects only).
// The HUD starts first so other features can register their lines before the first data arrives.
import { startHudController } from "client/features/hud";
import { startProfileController } from "client/features/profile";

startHudController();
startProfileController();
