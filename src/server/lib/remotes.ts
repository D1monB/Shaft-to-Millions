// Server side of networking. Creates RemoteEvents on demand and wraps every client handler in the
// security checklist from CLAUDE.md: rate limit per player, never throw on bad input, rate-limited abuse logs.
import { Players, ReplicatedStorage } from "@rbxts/services";
import { RateLimiter } from "shared/lib/rate-limiter";
import { REMOTES_FOLDER_NAME } from "shared/lib/remote-names";

let folder: Folder | undefined;

function getFolder(): Folder {
	if (folder === undefined) {
		const created = new Instance("Folder");
		created.Name = REMOTES_FOLDER_NAME;
		created.Parent = ReplicatedStorage;
		folder = created;
	}
	return folder;
}

/** Finds or creates the RemoteEvent with this name. Names come from each feature's network.ts. */
export function remoteEvent(name: string): RemoteEvent {
	const parent = getFolder();
	const existing = parent.FindFirstChild(name);
	if (existing !== undefined && existing.IsA("RemoteEvent")) {
		return existing;
	}
	const created = new Instance("RemoteEvent");
	created.Name = name;
	created.Parent = parent;
	return created;
}

/**
 * Creates a RemoteEvent that only the server fires (server -> client) at startup, before any player joins.
 * Created lazily on the first FireClient instead, a client would still be waiting for it (an "Infinite yield" warning)
 * and could connect its handler only AFTER the first message, losing exactly that message.
 */
export function declareClientEvent(name: string): void {
	remoteEvent(name);
}

// Abuse logs are rate limited too, so an attacker cannot flood the server output.
const abuseLogLimiter = new RateLimiter(5, 0.2);

/** Logs a rejected request. Only the UserId is logged: no names or other personal data. */
export function logAbuse(player: Player, reason: string): void {
	if (abuseLogLimiter.tryTake(player.UserId, os.clock())) {
		warn(`[abuse] user ${player.UserId}: ${reason}`);
	}
}

const limiters: RateLimiter[] = [abuseLogLimiter];
Players.PlayerRemoving.Connect((player) => {
	for (const limiter of limiters) {
		limiter.forget(player.UserId);
	}
});

/**
 * Connects a handler for requests from clients. The handler receives raw `unknown` arguments and must
 * validate count and types itself. Requests over the rate limit are dropped and logged.
 * Errors inside the handler are caught: one broken request never affects other players.
 */
export function onClientRequest(
	name: string,
	limiter: RateLimiter,
	handler: (player: Player, args: Array<unknown>) => void,
): void {
	limiters.push(limiter);
	remoteEvent(name).OnServerEvent.Connect((player, ...args) => {
		if (!limiter.tryTake(player.UserId, os.clock())) {
			logAbuse(player, `${name}: rate limit`);
			return;
		}
		const [ok, err] = pcall(handler, player, args);
		if (!ok) {
			warn(`[${name}] handler failed: ${err}`);
		}
	});
}

/** Sends a message to one client. */
export function fireClient(name: string, player: Player, ...args: Array<unknown>): void {
	remoteEvent(name).FireClient(player, ...args);
}
