import React from "@rbxts/react";
import { COLORS, FONTS, TEXT_SIZES, Tone, toneColor } from "./theme";

export interface LabelProps {
	readonly text: string | React.Binding<string>;
	readonly tone?: Tone;
	readonly size?: number;
	/** Display font (titles, numbers) instead of body text. */
	readonly display?: boolean;
	readonly bold?: boolean;
	readonly align?: "left" | "center" | "right";
	/** Dark outline around letters: needed when text sits on the 3D world, not on a panel. */
	readonly outlined?: boolean;
	readonly color?: Color3;
	readonly order?: number;
	readonly width?: UDim;
	readonly richText?: boolean;
}

const ALIGN = {
	left: Enum.TextXAlignment.Left,
	center: Enum.TextXAlignment.Center,
	right: Enum.TextXAlignment.Right,
};

/** Text that wraps and grows in height with its content. */
export function Label(props: LabelProps) {
	const font = props.display === true ? FONTS.display : props.bold === true ? FONTS.bodyBold : FONTS.body;
	return (
		<textlabel
			BackgroundTransparency={1}
			Size={new UDim2(props.width ?? new UDim(1, 0), new UDim(0, 0))}
			AutomaticSize={Enum.AutomaticSize.Y}
			Font={font}
			Text={props.text}
			TextSize={props.size ?? TEXT_SIZES.body}
			TextColor3={props.color ?? toneColor(props.tone ?? "normal")}
			TextWrapped={true}
			RichText={props.richText === true}
			TextXAlignment={ALIGN[props.align ?? "left"]}
			LayoutOrder={props.order ?? 0}
		>
			{props.outlined === true && <uistroke Color={COLORS.outline} Thickness={2} />}
		</textlabel>
	);
}
