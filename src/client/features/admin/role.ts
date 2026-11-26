// This player's admin role, as the server published it. Only decides what is SHOWN: the server checks every action.
import { Players } from "@rbxts/services";
import { ADMIN_ROLE_ATTRIBUTE, AdminRole } from "shared/features/admin";

export function ownRole(): AdminRole | undefined {
	const role = Players.LocalPlayer.GetAttribute(ADMIN_ROLE_ATTRIBUTE);
	return role === "owner" || role === "dev" ? role : undefined;
}
