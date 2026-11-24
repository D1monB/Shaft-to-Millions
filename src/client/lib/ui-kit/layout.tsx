import React from "@rbxts/react";
import { COLORS, RADIUS, STROKE } from "./theme";

export interface StackProps extends React.PropsWithChildren {
	readonly direction?: "vertical" | "horizontal";
	readonly gap?: number;
	readonly padding?: number;
	readonly order?: number;
	readonly align?: "start" | "center" | "end";
	/** Children are LayoutOrder-sorted; pass `order` to each child to fix its position. */
	readonly wrap?: boolean;
}

const H_ALIGN = {
	start: Enum.HorizontalAlignment.Left,
	center: Enum.HorizontalAlignment.Center,
	end: Enum.HorizontalAlignment.Right,
};

/** An invisible box that lays children out in a column or a row and grows with them. */
export function Stack(props: StackProps) {
	const horizontal = props.direction === "horizontal";
	const padding = new UDim(0, props.padding ?? 0);
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(1, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			LayoutOrder={props.order ?? 0}
		>
			<uilistlayout
				FillDirection={horizontal ? Enum.FillDirection.Horizontal : Enum.FillDirection.Vertical}
				Padding={new UDim(0, props.gap ?? 8)}
				SortOrder={Enum.SortOrder.LayoutOrder}
				HorizontalAlignment={H_ALIGN[props.align ?? "start"]}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Wraps={props.wrap === true}
			/>
			<uipadding PaddingTop={padding} PaddingBottom={padding} PaddingLeft={padding} PaddingRight={padding} />
			{props.children}
		</frame>
	);
}

export interface CardProps extends React.PropsWithChildren {
	readonly order?: number;
	/** Coloured border, e.g. rarity colour or "ready" green. */
	readonly accent?: Color3;
	readonly gap?: number;
}

/** A lighter plank inside a panel that groups related lines. */
export function Card(props: CardProps) {
	return (
		<frame
			BackgroundColor3={COLORS.wood}
			Size={new UDim2(1, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			LayoutOrder={props.order ?? 0}
		>
			<uicorner CornerRadius={RADIUS.medium} />
			<uistroke Color={props.accent ?? COLORS.outline} Thickness={props.accent ? STROKE.thick : STROKE.thin} />
			<uipadding
				PaddingTop={new UDim(0, 10)}
				PaddingBottom={new UDim(0, 12)}
				PaddingLeft={new UDim(0, 12)}
				PaddingRight={new UDim(0, 12)}
			/>
			<uilistlayout Padding={new UDim(0, props.gap ?? 6)} SortOrder={Enum.SortOrder.LayoutOrder} />
			{props.children}
		</frame>
	);
}

export interface ButtonRowProps extends React.PropsWithChildren {
	readonly order?: number;
	/** How many buttons share the row; each gets an equal width. */
	readonly count: number;
}

/** Buttons side by side with equal widths (pass width={rowItemWidth(count)} to each button). */
export function ButtonRow(props: ButtonRowProps) {
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(1, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			LayoutOrder={props.order ?? 0}
		>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				Padding={new UDim(0, ROW_GAP)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{props.children}
		</frame>
	);
}

const ROW_GAP = 8;

/** Width of one of `count` equal items in a ButtonRow. */
export function rowItemWidth(count: number): UDim {
	const safe = math.max(1, count);
	return new UDim(1 / safe, -(ROW_GAP * (safe - 1)) / safe);
}
