// hud feature (client): the always-visible top bar, stat column and menu. Other features add their own stats and buttons.
// Public API of this feature. Other code imports only from this file.
export { Hud, registerHudButton, registerHudStat } from "./hud";
export type { HudStat } from "./hud";
