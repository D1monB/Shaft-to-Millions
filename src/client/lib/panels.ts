// Which panel is open. Only one panel at a time keeps the screen readable on phones.
// A panel is described by a render function, so its contents re-render from live data on their own.
import React from "@rbxts/react";
import { Store, useStore } from "./store";

export interface PanelSpec {
	/** Stable id, e.g. "shop" or "machine_furnace". */
	readonly key: string;
	readonly title: string;
	readonly icon?: string;
	readonly render: () => React.Element;
}

const panelStore = new Store<PanelSpec | undefined>(undefined);

export function openPanel(spec: PanelSpec): void {
	panelStore.set(spec);
}

export function closePanel(): void {
	panelStore.set(undefined);
}

export function isPanelOpen(key: string): boolean {
	return panelStore.get()?.key === key;
}

export function useOpenPanel(): PanelSpec | undefined {
	return useStore(panelStore);
}
