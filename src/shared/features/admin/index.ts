// admin feature (shared): the developer panel's rules (decision 068).
// Public API of this feature. Other code imports only from this file.
export {
	MAX_GIVE_CRYSTALS,
	MAX_GIVE_MONEY,
	OWNER_USER_ID,
	isAdminAction,
	isAllowed,
	parseAdminRequest,
	roleOf,
} from "./admin";
export type { AdminAction, AdminRequest, AdminRole } from "./admin";

/** Client -> server: (action, targetUserId, amount?). Checked against the sender's role on the server. */
export const ADMIN_ACTION_REMOTE = "AdminAction";
/** Player attribute (server-set): "owner" or "dev"; absent for everyone else. */
export const ADMIN_ROLE_ATTRIBUTE = "AdminRole";
