// Small React hooks shared by client features.
import { useEffect, useState } from "@rbxts/react";
import { CollectionService, Workspace } from "@rbxts/services";

/**
 * Server time that ticks every `interval` seconds while the component is on screen.
 * Used for live timers (machine queues, drills): the client advances the server's data locally
 * between updates with the same shared functions the server uses.
 */
export function useServerClock(interval: number): number {
	const [now, setNow] = useState(Workspace.GetServerTimeNow());
	useEffect(() => {
		const thread = task.spawn(() => {
			for (;;) {
				task.wait(interval);
				setNow(Workspace.GetServerTimeNow());
			}
		});
		return () => task.cancel(thread);
	}, [interval]);
	return now;
}

/**
 * Instances with a CollectionService tag that are currently streamed in.
 * With StreamingEnabled parts come and go as the player moves, so the list updates on both signals.
 */
export function useTagged(tag: string): ReadonlyArray<Instance> {
	const [tagged, setTagged] = useState<ReadonlyArray<Instance>>(CollectionService.GetTagged(tag));
	useEffect(() => {
		const refresh = () => setTagged(CollectionService.GetTagged(tag));
		refresh();
		const added = CollectionService.GetInstanceAddedSignal(tag).Connect(refresh);
		const removed = CollectionService.GetInstanceRemovedSignal(tag).Connect(refresh);
		return () => {
			added.Disconnect();
			removed.Disconnect();
		};
	}, [tag]);
	return tagged;
}
