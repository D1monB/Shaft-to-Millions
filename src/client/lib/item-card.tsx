// The rarity card of a chest item, used by the chest odds grid and by the inventory.
// Coloured by rarity, with an icon, the name, a rarity pill and the effect; optional corner pills and a footer for buttons.
import React from "@rbxts/react";
import { ITEMS, ItemId, RARITY_NAMES } from "shared/config/items";
import { KIND_ICONS, RARITY_LIGHT, RARITY_RAMPS, effectText } from "./item-display";
import { COLORS, FONTS, RADIUS, STROKE, Sunburst, rampSequence } from "./ui-kit";

/** Height of the card without a footer. */
export const ITEM_CARD_HEIGHT = 200;
/** Extra height a footer with one row of buttons needs. */
export const ITEM_CARD_FOOTER = 66;
const CARD_DEPTH = 5;

export interface CornerPill {
	readonly text: string;
	readonly color: Color3;
}

export interface ItemCardProps {
	readonly item: ItemId;
	/** Top-right pill, e.g. the chance "45%" or the count "×3". */
	readonly topRight?: CornerPill;
	/** Top-left pill, e.g. "✔ НАДІТО". */
	readonly topLeft?: CornerPill;
	/** Green outline: the item is in use. */
	readonly highlighted?: boolean;
	/** Buttons under the effect; the parent grid must make the cell ITEM_CARD_FOOTER taller. */
	readonly footer?: React.Element;
	readonly order?: number;
}

function Pill(props: { pill: CornerPill; left: boolean }) {
	return (
		<frame
			AnchorPoint={new Vector2(props.left ? 0 : 1, 0)}
			Position={new UDim2(props.left ? 0 : 1, props.left ? 8 : -8, 0, 8)}
			Size={new UDim2(0, 0, 0, 26)}
			AutomaticSize={Enum.AutomaticSize.X}
			BackgroundColor3={COLORS.outline}
			BackgroundTransparency={0.15}
			ZIndex={4}
		>
			<uicorner CornerRadius={RADIUS.small} />
			<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} />
			<textlabel
				BackgroundTransparency={1}
				Size={new UDim2(0, 0, 1, 0)}
				AutomaticSize={Enum.AutomaticSize.X}
				Font={FONTS.display}
				Text={props.pill.text}
				TextSize={16}
				TextColor3={props.pill.color}
				ZIndex={5}
			/>
		</frame>
	);
}

function Content(props: ItemCardProps) {
	const def = ITEMS[props.item];
	const light = RARITY_LIGHT[def.rarity];
	return (
		<>
			{props.topLeft !== undefined && <Pill pill={props.topLeft} left={true} />}
			{props.topRight !== undefined && <Pill pill={props.topRight} left={false} />}
			<textlabel
				AnchorPoint={new Vector2(0.5, 0)}
				BackgroundTransparency={1}
				Position={new UDim2(0.5, 0, 0, 30)}
				Size={new UDim2(0, 80, 0, 58)}
				Text={KIND_ICONS[def.kind]}
				TextSize={48}
				ZIndex={3}
			/>
			<textlabel
				BackgroundTransparency={1}
				Position={new UDim2(0, 6, 0, 92)}
				Size={new UDim2(1, -12, 0, 26)}
				Font={FONTS.display}
				Text={def.name}
				TextColor3={COLORS.white}
				TextScaled={true}
				ZIndex={3}
			>
				<uitextsizeconstraint MaxTextSize={21} MinTextSize={12} />
				<uistroke Color={COLORS.outline} Thickness={2} />
			</textlabel>
			<frame
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 120)}
				Size={new UDim2(0, 0, 0, 22)}
				AutomaticSize={Enum.AutomaticSize.X}
				BackgroundColor3={COLORS.outline}
				BackgroundTransparency={0.25}
				ZIndex={3}
			>
				<uicorner CornerRadius={RADIUS.round} />
				<uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} />
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(0, 0, 1, 0)}
					AutomaticSize={Enum.AutomaticSize.X}
					Font={FONTS.display}
					Text={RARITY_NAMES[def.rarity].upper()}
					TextSize={13}
					TextColor3={light}
					ZIndex={4}
				/>
			</frame>
			<frame
				BackgroundColor3={COLORS.black}
				BackgroundTransparency={0.8}
				BorderSizePixel={0}
				Position={new UDim2(0, 10, 0, 150)}
				Size={new UDim2(1, -20, 0, 2)}
				ZIndex={3}
			/>
			<textlabel
				BackgroundTransparency={1}
				Position={new UDim2(0, 6, 0, 154)}
				Size={new UDim2(1, -12, 0, 38)}
				Font={FONTS.display}
				Text={effectText(def.kind, def.bonus)}
				TextColor3={COLORS.white}
				TextScaled={true}
				TextWrapped={true}
				ZIndex={3}
			>
				<uitextsizeconstraint MaxTextSize={15} MinTextSize={10} />
				<uistroke Color={COLORS.outline} Thickness={1.5} />
			</textlabel>
			{props.footer !== undefined && (
				<frame
					BackgroundTransparency={1}
					Position={new UDim2(0, 8, 0, ITEM_CARD_HEIGHT - 4)}
					Size={new UDim2(1, -16, 0, ITEM_CARD_FOOTER - 6)}
					ZIndex={4}
				>
					{props.footer}
				</frame>
			)}
		</>
	);
}

/**
 * One item as a card. Fills its parent cell (give the grid cell ITEM_CARD_HEIGHT, plus ITEM_CARD_FOOTER with a footer).
 * The legendary card turns light rays behind its content; rays need a CanvasGroup to be clipped to the card.
 */
export function ItemCard(props: ItemCardProps) {
	const rarity = ITEMS[props.item].rarity;
	const ramp = RARITY_RAMPS[rarity];
	const faceSize = new UDim2(1, 0, 1, -CARD_DEPTH);
	const face =
		rarity === "legendary" ? (
			<canvasgroup BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={faceSize}>
				<uicorner CornerRadius={RADIUS.large} />
				<uigradient Rotation={90} Color={rampSequence(ramp)} />
				<Sunburst zIndex={1} />
				<Content {...props} />
			</canvasgroup>
		) : (
			<frame BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={faceSize}>
				<uicorner CornerRadius={RADIUS.large} />
				<uigradient Rotation={90} Color={rampSequence(ramp)} />
				<Content {...props} />
			</frame>
		);
	return (
		<frame BackgroundTransparency={1} LayoutOrder={props.order ?? 0}>
			<frame
				BackgroundColor3={COLORS.outline}
				BorderSizePixel={0}
				Position={new UDim2(0, 0, 0, CARD_DEPTH)}
				Size={faceSize}
			>
				<uicorner CornerRadius={RADIUS.large} />
			</frame>
			{face}
			{/* The outline sits on its own layer: a CanvasGroup would cut a stroke drawn on itself. */}
			<frame BackgroundTransparency={1} Size={faceSize} ZIndex={5}>
				<uicorner CornerRadius={RADIUS.large} />
				<uistroke
					Color={props.highlighted === true ? COLORS.success : COLORS.outline}
					Thickness={props.highlighted === true ? STROKE.heavy + 1 : STROKE.thick}
				/>
			</frame>
		</frame>
	);
}
