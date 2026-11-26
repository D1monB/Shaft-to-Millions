// Developer (admin) rules (decision 068). The owner is fixed by UserId (never by name: names can change hands). Only
// the owner grants or removes the developer role; developers help but can never act against the owner.
import { isIntegerInRange } from "shared/lib/validate";

/** The owner of the game (account D1monB2). A public id, not a secret. */
export const OWNER_USER_ID = 12034221780;

export type AdminRole = "owner" | "dev";

export const MAX_GIVE_MONEY = 1_000_000_000_000;
export const MAX_GIVE_CRYSTALS = 1_000_000;
const MAX_USER_ID = 1_000_000_000_000_000;

export type AdminAction = "money" | "crystals" | "kick" | "bring" | "grant" | "revoke";

export function isAdminAction(value: unknown): value is AdminAction {
	return (
		value === "money" ||
		value === "crystals" ||
		value === "kick" ||
		value === "bring" ||
		value === "grant" ||
		value === "revoke"
	);
}

export function roleOf(userId: number, grantedDev: boolean): AdminRole | undefined {
	if (userId === OWNER_USER_ID) {
		return "owner";
	}
	return grantedDev ? "dev" : undefined;
}

export interface AdminRequest {
	readonly action: AdminAction;
	readonly targetId: number;
	/** Money or crystals to give; 0 for other actions. */
	readonly amount: number;
}

/** Turns raw remote arguments into a request, or undefined when anything is off. */
export function parseAdminRequest(args: ReadonlyArray<unknown>): AdminRequest | undefined {
	const [action, targetId, amount] = args;
	if (!isAdminAction(action) || !isIntegerInRange(targetId, 1, MAX_USER_ID)) {
		return undefined;
	}
	if (action === "money" || action === "crystals") {
		const limit = action === "money" ? MAX_GIVE_MONEY : MAX_GIVE_CRYSTALS;
		return args.size() === 3 && isIntegerInRange(amount, 1, limit) ? { action, targetId, amount } : undefined;
	}
	return args.size() === 2 ? { action, targetId, amount: 0 } : undefined;
}

/** Whether `role` may do `request`. Developers cannot manage roles or touch the owner. */
export function isAllowed(role: AdminRole | undefined, actorId: number, request: AdminRequest): boolean {
	if (role === undefined) {
		return false;
	}
	const ownerTarget = request.targetId === OWNER_USER_ID;
	if (request.action === "grant" || request.action === "revoke") {
		return role === "owner" && !ownerTarget;
	}
	if (ownerTarget && actorId !== OWNER_USER_ID) {
		return false;
	}
	// Kicking or "bringing" yourself makes no sense.
	return !((request.action === "kick" || request.action === "bring") && request.targetId === actorId);
}
