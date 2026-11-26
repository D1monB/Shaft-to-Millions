// One pickaxe card of the hotbar (redesigned, decision 068): the 3D pickaxe on a gradient in its tier's colour, the
// number key, a tier badge; the chosen one rises with a glowing gold frame.
import React from "@rbxts/react";
import { PickaxeDef } from "shared/config/pickaxes";
import { ModelIcon, pickaxeTemplate } from "client/lib/model-icon";
import { COLORS, FONTS, RADIUS, TEXT_SIZES } from "client/lib/ui-kit";

/** Tier 1..5: brown, green, blue, purple, gold. */
const TIER_COLORS: ReadonlyArray<Color3> = [
	Color3.fromRGB(150, 105, 70),
	Color3.fromRGB(70, 170, 90),
	Color3.fromRGB(70, 130, 230),
	Color3.fromRGB(160, 90, 230),
	Color3.fromRGB(235, 170, 40),
];
const GOLD = Color3.fromRGB(255, 214, 90);
/** How far the chosen card rises above the others. */
export const CHOSEN_LIFT = 8;

export interface HotbarSlotProps {
	readonly def: PickaxeDef;
	readonly index: number;
	readonly size: number;
	readonly keyLabel: string | undefined;
	readonly chosen: boolean;
	readonly onClick: () => void;
}

export function HotbarSlot(props: HotbarSlotProps) {
	const tier = TIER_COLORS[math.clamp(props.def.tier, 1, TIER_COLORS.size()) - 1];
	const template = pickaxeTemplate(props.def.tool);
	const size = props.size;
	return (
		<frame BackgroundTransparency={1} Size={UDim2.fromOffset(size, size + CHOSEN_LIFT)} LayoutOrder={props.index}>
			<textbutton
				Text=""
				AutoButtonColor={false}
				Position={UDim2.fromOffset(0, props.chosen ? 0 : CHOSEN_LIFT)}
				Size={UDim2.fromOffset(size, size)}
				BackgroundColor3={COLORS.white}
				BorderSizePixel={0}
				Event={{ Activated: props.onClick }}
			>
				<uicorner CornerRadius={RADIUS.medium} />
				<uigradient
					Rotation={90}
					Color={new ColorSequence(tier, tier.Lerp(Color3.fromRGB(16, 14, 22), 0.75))}
				/>
				<uistroke
					Color={props.chosen ? GOLD : COLORS.outline}
					Thickness={props.chosen ? 3.5 : 2}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				{template !== undefined ? (
					<ModelIcon template={template} size={new UDim2(1, -6, 1, -6)} position={UDim2.fromOffset(3, 3)} />
				) : (
					<textlabel BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Text="⛏" TextScaled={true} />
				)}
				{props.keyLabel !== undefined && (
					<textlabel
						BackgroundColor3={COLORS.outline}
						BackgroundTransparency={0.2}
						Position={UDim2.fromOffset(3, 3)}
						Size={UDim2.fromOffset(16, 16)}
						Font={FONTS.display}
						Text={props.keyLabel}
						TextSize={TEXT_SIZES.small - 1}
						TextColor3={props.chosen ? GOLD : COLORS.white}
						ZIndex={3}
					>
						<uicorner CornerRadius={RADIUS.small} />
					</textlabel>
				)}
				<textlabel
					AnchorPoint={new Vector2(1, 1)}
					BackgroundColor3={tier}
					Position={new UDim2(1, -3, 1, -3)}
					Size={UDim2.fromOffset(22, 14)}
					Font={FONTS.display}
					Text={`T${props.def.tier}`}
					TextSize={11}
					TextColor3={COLORS.white}
					ZIndex={3}
				>
					<uicorner CornerRadius={RADIUS.small} />
					<uistroke Color={COLORS.outline} Thickness={1} />
				</textlabel>
			</textbutton>
		</frame>
	);
}
