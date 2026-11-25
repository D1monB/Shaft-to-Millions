import React from "@rbxts/react";
import { Button } from "./button";
import { rowItemWidth } from "./layout";
import { TEXT_SIZES } from "./theme";

export interface TabItem {
	readonly key: string;
	readonly label: string;
	/** A small count after the label, e.g. how many items are in the tab. */
	readonly count?: number;
}

export interface TabsProps {
	readonly items: ReadonlyArray<TabItem>;
	readonly selected: string;
	readonly onSelect: (key: string) => void;
	readonly order?: number;
}

/** A row of equal-width tab buttons: the selected one is gold, the others are planks. */
export function Tabs(props: TabsProps) {
	const count = props.items.size();
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(1, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			LayoutOrder={props.order ?? 0}
		>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				Padding={new UDim(0, 8)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{props.items.map((item, index) => (
				<Button
					key={item.key}
					text={item.count !== undefined ? `${item.label} · ${item.count}` : item.label}
					variant={item.key === props.selected ? "primary" : "secondary"}
					onClick={() => props.onSelect(item.key)}
					width={rowItemWidth(count)}
					textSize={TEXT_SIZES.small + 2}
					order={index}
				/>
			))}
		</frame>
	);
}
