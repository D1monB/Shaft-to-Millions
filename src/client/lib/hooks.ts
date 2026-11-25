// Small React hooks shared by client features.
import { useEffect, useRef, useState } from "@rbxts/react";
import { CollectionService, Workspace } from "@rbxts/services";

/**
 * Server time that ticks every `interval` seconds while the component is on screen.
 * Used for live timers (machine queues, drills): the client advances the server's data locally
 * between updates with the same shared functions the server uses.
 *
 * `isActive` (optional) says whether anything on screen still changes with time at this moment. While it returns
 * false the clock stays still and the component is NOT re-rendered (an idle machine panel would otherwise redraw
 * every tick for nothing). One last update is sent when it turns false, so the final state is drawn.
 */
export function useServerClock(interval: number, isActive?: (now: number) => boolean): number {
	const [now, setNow] = useState(Workspace.GetServerTimeNow());
	// The latest callback, read by the long-lived loop below: it closes over the data of the newest render.
	const activeRef = useRef(isActive);
	activeRef.current = isActive;
	useEffect(() => {
		let wasActive = true;
		const thread = task.spawn(() => {
			for (;;) {
				task.wait(interval);
				const time = Workspace.GetServerTimeNow();
				const active = activeRef.current === undefined || activeRef.current(time);
				if (active || wasActive) {
					setNow(time);
				}
				wasActive = active;
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
