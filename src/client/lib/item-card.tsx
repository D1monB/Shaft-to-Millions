// The coloured card: an icon, the name, a pill and a one-line effect; optional corner pills and a footer for buttons.
// RarityCard is the generic card (the shop uses it for gear); ItemCard fills it from a chest item.
import React from "@rbxts/react";
import { ITEMS, ItemId, RARITY_NAMES } from "shared/config/items";
import { KIND_ICONS, RARITY_LIGHT, RARITY_RAMPS, effectText } from "./item-display";
import { COLORS, FONTS, RADIUS, Ramp, STROKE, Sunburst, TEXT_SIZES, rampSequence } from "./ui-kit";

/** Height of the card without a footer. */
export const ITEM_CARD_HEIGHT = 170;
/** Extra height a footer with one row of buttons needs. */
export const ITEM_CARD_FOOTER = 56;
/** Width of a card in a left-right strip (CardStrip). */
export const ITEM_CARD_WIDTH = 148;
const CARD_DEPTH = 3;

export interface CornerPill {
	readonly text: string;
	readonly color: Color3;
}

interface CardDecor {
	/** Top-right pill, e.g. the chance "45%" or the count "×3". */
	readonly topRight?: CornerPill;
	/** Top-left pill, e.g. "✅ НАДІТО". */
	readonly topLeft?: CornerPill;
	/** Green outline: the item is in use. */
	readonly highlighted?: boolean;
	/** Buttons under the effect; the parent grid must make the cell ITEM_CARD_FOOTER (or footerHeight) taller. */
	readonly footer?: React.Element;
	/** Height of the footer area, when it holds more than one row of buttons. Default ITEM_CARD_FOOTER. */
	readonly footerHeight?: number;
	readonly order?: number;
}

export interface ItemCardProps extends CardDecor {
	readonly item: ItemId;
}

export interface RarityCardProps extends CardDecor {
	readonly ramp: Ramp;
	/** Text colour of the middle pill. */
	readonly light: Color3;
	readonly icon: string;
	readonly name: string;
	/** Middle pill, e.g. "ЛЕГЕНДАРНИЙ" or "РІВЕНЬ 3". */
	readonly pill: string;
	readonly effect: string;
	/** Light rays behind the content: the best card of a set. */
	readonly rays?: boolean;
	/** Darkened: not available yet. The footer stays bright so its hint is readable. */
	readonly dimmed?: boolean;
}

function Pill(props: { pill: CornerPill; left: boolean }) {
	return (
		<frame
			AnchorPoint={new Vector2(props.left ? 0 : 1, 0)}
			Position={new UDim2(props.left ? 0 : 1, props.left ? 8 : -8, 0, 8)}
			Size={new UDim2(0, 0, 0, 22)}
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
				TextSize={TEXT_SIZES.small}
				TextColor3={props.pill.color}
				ZIndex={5}
			/>
		</frame>
	);
}

function Content(props: RarityCardProps) {
	return (
		<>
			{props.topLeft !== undefined && <Pill pill={props.topLeft} left={true} />}
			{props.topRight !== undefined && <Pill pill={props.topRight} left={false} />}
			<textlabel
				AnchorPoint={new Vector2(0.5, 0)}
				BackgroundTransparency={1}
				Position={new UDim2(0.5, 0, 0, 22)}
				Size={new UDim2(0, 70, 0, 50)}
				Text={props.icon}
				TextSize={40}
				ZIndex={3}
			/>
			<textlabel
				BackgroundTransparency={1}
				Position={new UDim2(0, 6, 0, 74)}
				Size={new UDim2(1, -12, 0, 22)}
				Font={FONTS.display}
				Text={props.name}
				TextColor3={COLORS.white}
				TextScaled={true}
				ZIndex={3}
			>
				<uitextsizeconstraint MaxTextSize={18} MinTextSize={12} />
				<uistroke Color={COLORS.outline} Thickness={2} />
			</textlabel>
			<frame
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 99)}
				Size={new UDim2(0, 0, 0, 20)}
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
					Text={props.pill}
					TextSize={13}
					TextColor3={props.light}
					ZIndex={4}
				/>
			</frame>
			<frame
				BackgroundColor3={COLORS.black}
				BackgroundTransparency={0.8}
				BorderSizePixel={0}
				Position={new UDim2(0, 10, 0, 125)}
				Size={new UDim2(1, -20, 0, 1)}
				ZIndex={3}
			/>
			<textlabel
				BackgroundTransparency={1}
				Position={new UDim2(0, 6, 0, 129)}
				Size={new UDim2(1, -12, 0, 34)}
				Font={FONTS.display}
				Text={props.effect}
				TextColor3={COLORS.white}
				TextSize={TEXT_SIZES.small}
				TextWrapped={true}
				ZIndex={3}
			>
				<uistroke Color={COLORS.outline} Thickness={1.5} />
			</textlabel>
			{props.dimmed === true && (
				<frame
					BackgroundColor3={COLORS.black}
					BackgroundTransparency={0.45}
					Size={UDim2.fromScale(1, 1)}
					ZIndex={6}
				>
					<uicorner CornerRadius={RADIUS.large} />
				</frame>
			)}
			{props.footer !== undefined && (
				<frame
					BackgroundTransparency={1}
					Position={new UDim2(0, 8, 0, ITEM_CARD_HEIGHT - 4)}
					Size={new UDim2(1, -16, 0, (props.footerHeight ?? ITEM_CARD_FOOTER) - 6)}
					ZIndex={7}
				>
					{props.footer}
				</frame>
			)}
		</>
	);
}

/** The rarity colour as a glow over the top of the dark card, fading out toward the middle. */
function RarityGlow(props: { ramp: Ramp }) {
	return (
		<frame BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={new UDim2(1, 0, 0.62, 0)} ZIndex={1}>
			<uicorner CornerRadius={RADIUS.large} />
			<uigradient
				Rotation={90}
				Color={rampSequence(props.ramp)}
				Transparency={
					new NumberSequence([new NumberSequenceKeypoint(0, 0.15), new NumberSequenceKeypoint(1, 1)])
				}
			/>
		</frame>
	);
}

/**
 * One card: dark glass with the rarity colour glowing from the top and a rarity-coloured outline ("dark glass +
 * neon", decision 029). Fills its parent (a StripSlot or a grid cell). Rays need a CanvasGroup to be clipped.
 */
export function RarityCard(props: RarityCardProps) {
	const faceSize = new UDim2(1, 0, 1, -CARD_DEPTH);
	const face =
		props.rays === true ? (
			<canvasgroup BackgroundColor3={COLORS.wood} BorderSizePixel={0} Size={faceSize}>
				<uicorner CornerRadius={RADIUS.large} />
				<RarityGlow ramp={props.ramp} />
				<Sunburst zIndex={1} />
				<Content {...props} />
			</canvasgroup>
		) : (
			<frame BackgroundColor3={COLORS.wood} BorderSizePixel={0} Size={faceSize}>
				<uicorner CornerRadius={RADIUS.large} />
				<RarityGlow ramp={props.ramp} />
				<Content {...props} />
			</frame>
		);
	return (
		<frame BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} LayoutOrder={props.order ?? 0}>
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
					Color={props.highlighted === true ? COLORS.success : props.light}
					Thickness={props.highlighted === true ? STROKE.heavy + 0.5 : STROKE.thin}
					Transparency={props.highlighted === true ? 0 : 0.25}
				/>
			</frame>
		</frame>
	);
}

/** A chest item as a rarity card; the legendary one turns light rays. */
export function ItemCard(props: ItemCardProps) {
	const def = ITEMS[props.item];
	return (
		<RarityCard
			{...props}
			ramp={RARITY_RAMPS[def.rarity]}
			light={RARITY_LIGHT[def.rarity]}
			icon={KIND_ICONS[def.kind]}
			name={def.name}
			pill={RARITY_NAMES[def.rarity].upper()}
			effect={effectText(def.kind, def.bonus)}
			rays={def.rarity === "legendary"}
		/>
	);
}
