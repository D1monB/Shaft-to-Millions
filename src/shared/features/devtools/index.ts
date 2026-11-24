// devtools feature (shared): play-test shortcuts (money, max gear, open layers). Studio only, see the server service.
// Public API of this feature. Other code imports only from this file.
export { DEV_MONEY_AMOUNTS, applyDevCommand, parseDevCommand } from "./devtools";
export type { DevCommand } from "./devtools";
export { DEV_COMMAND_REMOTE } from "./network";
