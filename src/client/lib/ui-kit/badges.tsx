import { useMotion } from "@rbxts/pretty-react-hooks";
import React from "@rbxts/react";
import { COLORS, FONTS, RADIUS, SPRINGS, STROKE, TEXT_SIZES, Tone, toneColor } from "./theme";

export interface StatChipProps {
	readonly icon: string;
	readonly text: string;
	readonly tone?: Tone;
	readonly order?: number;
}

/** A small pill with an emoji and one short value, for the HUD column. */
export function StatChip(props: StatChipProps) {
	return (
		<frame
			BackgroundColor3={COLORS.woodDark}
			BackgroundTransparency={0.1}
			Size={new UDim2(0, 0, 0, 44)}
			AutomaticSize={Enum.AutomaticSize.X}
			LayoutOrder={props.order ?? 0}
		>
			<uicorner CornerRadius={RADIUS.round} />
			<uistroke Color={COLORS.outline} Thickness={STROKE.thin} />
			<uipadding PaddingLeft={new UDim(0, 5)} PaddingRight={new UDim(0, 14)} />
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, 6)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			<textlabel
				BackgroundColor3={COLORS.wood}
				Size={new UDim2(0, 34, 0, 34)}
				Text={props.icon}
				TextSize={22}
				Font={FONTS.display}
				LayoutOrder={1}
			>
				<uicorner CornerRadius={RADIUS.round} />
			</textlabel>
			<textlabel
				BackgroundTransparency={1}
				Size={new UDim2(0, 0, 1, 0)}
				AutomaticSize={Enum.AutomaticSize.X}
				Font={FONTS.display}
				Text={props.text}
				TextSize={TEXT_SIZES.body}
				TextColor3={toneColor(props.tone ?? "normal")}
				LayoutOrder={2}
			>
				<uistroke Color={COLORS.outline} Thickness={1.5} />
			</textlabel>
		</frame>
	);
}

export interface MenuButtonProps {
	readonly icon: string;
	readonly label: string;
	readonly onClick: () => void;
	readonly order?: number;
	readonly color?: Color3;
}

/** A square HUD button with a big emoji and a caption under it (bottom menu). */
export function MenuButton(props: MenuButtonProps) {
	const [scale, scaleMotion] = useMotion(1);
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(0, 96, 0, 112)} LayoutOrder={props.order ?? 0}>
			<uiscale Scale={scale} />
			<textbutton
				AutoButtonColor={false}
				BackgroundColor3={props.color ?? COLORS.woodLight}
				Size={new UDim2(0, 80, 0, 80)}
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 0)}
				Font={FONTS.display}
				Text={props.icon}
				TextSize={42}
				Event={{
					Activated: props.onClick,
					MouseEnter: () => scaleMotion.spring(1.08, SPRINGS.bouncy),
					MouseLeave: () => scaleMotion.spring(1, SPRINGS.bouncy),
					MouseButton1Down: () => scaleMotion.spring(0.92, SPRINGS.snappy),
					MouseButton1Up: () => scaleMotion.spring(1, SPRINGS.bouncy),
				}}
			>
				<uicorner CornerRadius={RADIUS.medium} />
				<uistroke
					Color={COLORS.outline}
					Thickness={STROKE.heavy}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
			</textbutton>
			<textlabel
				BackgroundTransparency={1}
				AnchorPoint={new Vector2(0.5, 1)}
				Position={new UDim2(0.5, 0, 1, 0)}
				Size={new UDim2(1, 16, 0, 26)}
				Font={FONTS.display}
				Text={props.label}
				TextSize={TEXT_SIZES.small + 2}
				TextColor3={COLORS.text}
			>
				<uistroke Color={COLORS.outline} Thickness={2} />
			</textlabel>
		</frame>
	);
}
