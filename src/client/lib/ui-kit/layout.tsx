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

/** A dark inset well inside a panel that groups related lines. A coloured accent outlines it (rarity, "ready"). */
export function Card(props: CardProps) {
	return (
		<frame
			BackgroundColor3={COLORS.well}
			BackgroundTransparency={0.15}
			Size={new UDim2(1, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			LayoutOrder={props.order ?? 0}
		>
			<uicorner CornerRadius={RADIUS.large} />
			<uistroke Color={props.accent ?? COLORS.outline} Thickness={STROKE.thick} />
			<uipadding
				PaddingTop={new UDim(0, 12)}
				PaddingBottom={new UDim(0, 14)}
				PaddingLeft={new UDim(0, 14)}
				PaddingRight={new UDim(0, 14)}
			/>
			<uilistlayout Padding={new UDim(0, props.gap ?? 8)} SortOrder={Enum.SortOrder.LayoutOrder} />
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

export interface CardStripProps extends React.PropsWithChildren {
	/** Height of every card (plus room for the scroll bar). */
	readonly cardHeight: number;
	/** Width of every card. */
	readonly cardWidth: number;
	readonly order?: number;
	readonly gap?: number;
}

/**
 * A row of cards that scrolls left-right (developer's request 2026-11-25: vertical grids were awkward, the chest
 * odds needed scrolling down to the open button). Each child must have the size cardWidth x cardHeight.
 */
export function CardStrip(props: CardStripProps) {
	const bar = 6;
	return (
		<scrollingframe
			BackgroundTransparency={1}
			BorderSizePixel={0}
			Size={new UDim2(1, 0, 0, props.cardHeight + bar + 10)}
			CanvasSize={new UDim2(0, 0, 0, 0)}
			AutomaticCanvasSize={Enum.AutomaticSize.X}
			ScrollingDirection={Enum.ScrollingDirection.X}
			ScrollBarThickness={bar}
			ScrollBarImageColor3={COLORS.textMuted}
			HorizontalScrollBarInset={Enum.ScrollBarInset.None}
			ElasticBehavior={Enum.ElasticBehavior.Always}
			LayoutOrder={props.order ?? 0}
		>
			<uipadding PaddingTop={new UDim(0, 4)} PaddingLeft={new UDim(0, 2)} PaddingRight={new UDim(0, 2)} />
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				Padding={new UDim(0, props.gap ?? 10)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{props.children}
		</scrollingframe>
	);
}

/** One fixed-size slot in a CardStrip (an ItemCard fills its parent). */
export function StripSlot(props: React.PropsWithChildren<{ width: number; height: number; order?: number }>) {
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(0, props.width, 0, props.height)}
			LayoutOrder={props.order ?? 0}
		>
			{props.children}
		</frame>
	);
}
