// A tiny observable value with a React hook. Enough for UI state (open panel, toasts, the player's view)
// without pulling in a state library. Values are replaced, never mutated, so React sees every change.
import { useEffect, useState } from "@rbxts/react";

export class Store<T> {
	private value: T;
	private readonly listeners = new Set<(value: T) => void>();

	public constructor(initial: T) {
		this.value = initial;
	}

	public get(): T {
		return this.value;
	}

	public set(value: T): void {
		this.value = value;
		for (const listener of this.listeners) {
			// One broken listener must not stop the others (same rule as per-player server work).
			const [ok, err] = pcall(listener, value);
			if (!ok) {
				warn(`[store] listener failed: ${err}`);
			}
		}
	}

	/** Returns a function that stops listening. */
	public subscribe(listener: (value: T) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

/** Re-renders the component whenever the store changes. */
export function useStore<T>(store: Store<T>): T {
	const [value, setValue] = useState<T>(store.get());
	useEffect(() => {
		// The updater form is used because T may itself be a function (React would call it).
		setValue(() => store.get());
		return store.subscribe((updated) => setValue(() => updated));
	}, [store]);
	return value;
}
