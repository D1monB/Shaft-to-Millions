// Play-test shortcuts. Registered ONLY in Roblox Studio: on a live server this function returns immediately,
// the remote is never created, and a client has nothing to call. This is the whole access control, so do not
// replace it with a "for admins" check without a full security review (see docs/decisions.md #011).
import { RunService } from "@rbxts/services";
import { DEV_COMMAND_REMOTE, applyDevCommand, parseDevCommand } from "shared/features/devtools";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getProfileData, markDirty } from "server/features/profile";
import { notify } from "server/lib/notify";
import { logAbuse, onClientRequest } from "server/lib/remotes";

function handle(player: Player, args: Array<unknown>): void {
	const command = parseDevCommand(args);
	if (command === undefined) {
		logAbuse(player, "bad DevCommand arguments");
		return;
	}
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	applyDevCommand(data, command);
	markDirty(player);
	// UserId only, no names: same rule as every other log in the project.
	warn(`[devtools] user ${player.UserId} used ${command.kind}`);
	notify(player, "Dev: готово.", "success");
}

export function startDevtoolsService(): void {
	if (!RunService.IsStudio()) {
		return;
	}
	onClientRequest(DEV_COMMAND_REMOTE, new RateLimiter(5, 2), handle);
}
