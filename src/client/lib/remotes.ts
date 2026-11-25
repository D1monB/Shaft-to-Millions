// Client side of networking. The server creates all RemoteEvents; the client only waits for them.
import { ReplicatedStorage } from "@rbxts/services";
import { REMOTES_FOLDER_NAME } from "shared/lib/remote-names";

function getRemote(name: string): RemoteEvent {
	const folder = ReplicatedStorage.WaitForChild(REMOTES_FOLDER_NAME);
	return folder.WaitForChild(name) as RemoteEvent;
}

/** Sends an intent to the server. The server validates everything; the client never decides outcomes. */
export function sendToServer(name: string, ...args: Array<unknown>): void {
	task.spawn(() => getRemote(name).FireServer(...args));
}

/** Listens for visual-only messages from the server (an UnreliableRemoteEvent: some may never arrive). */
export function onServerUnreliable(name: string, callback: (...args: Array<unknown>) => void): void {
	task.spawn(() => {
		const remote = ReplicatedStorage.WaitForChild(REMOTES_FOLDER_NAME).WaitForChild(name);
		if (remote.IsA("UnreliableRemoteEvent")) {
			remote.OnClientEvent.Connect(callback);
		}
	});
}

/** Listens for messages from the server. */
export function onServerMessage(name: string, callback: (...args: Array<unknown>) => void): void {
	task.spawn(() => {
		getRemote(name).OnClientEvent.Connect(callback);
	});
}
