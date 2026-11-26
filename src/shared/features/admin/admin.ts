// Developer (admin) rules (decision 068). The owner is fixed by UserId (never by name: names can change hands). Only
// the owner grants or removes the developer role; developers help but can never act against the owner.
import { isIntegerInRange } from "shared/lib/validate";

/** The owner of the game (account D1monB2). A public id, not a secret. */
export const OWNER_USER_ID = 12034221780;

export type AdminRole = "owner" | "dev";

export const MAX_GIVE_MONEY = 1_000_000_000_000;
export const MAX_GIVE_CRYSTALS = 1_000_000;
const MAX_USER_ID = 1_000_000_000_000_000;

export const ADMIN_ACTIONS = [
	"money",
	"crystals",
	"takeMoney",
	"takeCrystals",
	"kick",
	"bring",
	"goto",
	"heal",
	"unlock",
	"boost",
	"spins",
	"reset",
	"grant",
	"revoke",
] as const;

export type AdminAction = (typeof ADMIN_ACTIONS)[number];

export function isAdminAction(value: unknown): value is AdminAction {
	return typeIs(value, "string") && (ADMIN_ACTIONS as ReadonlyArray<string>).includes(value);
}

/** Actions that need an amount. */
const AMOUNT_ACTIONS: ReadonlyArray<AdminAction> = ["money", "crystals", "takeMoney", "takeCrystals"];

/** Actions that make no sense on yourself. */
const NOT_ON_SELF: ReadonlyArray<AdminAction> = ["kick", "bring", "goto"];

/** Only the owner: roles, and wiping someone's progress. */
const OWNER_ONLY: ReadonlyArray<AdminAction> = ["grant", "revoke", "reset"];

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
	if (AMOUNT_ACTIONS.includes(action)) {
		const limit = action === "money" || action === "takeMoney" ? MAX_GIVE_MONEY : MAX_GIVE_CRYSTALS;
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
	if (OWNER_ONLY.includes(request.action)) {
		// The owner may reset their own progress; nobody changes the owner's role.
		return role === "owner" && (request.action === "reset" || !ownerTarget);
	}
	if (ownerTarget && actorId !== OWNER_USER_ID) {
		return false;
	}
	return !(NOT_ON_SELF.includes(request.action) && request.targetId === actorId);
}
