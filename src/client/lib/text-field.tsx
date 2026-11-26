// A themed one-line text input (promo codes, the developer panel). Text only: whatever reads it must validate it.
import React from "@rbxts/react";
import { COLORS, FONTS, RADIUS, STROKE, TEXT_SIZES } from "./ui-kit";

export interface TextFieldProps {
	readonly placeholder: string;
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly order?: number;
}

export function TextField(props: TextFieldProps) {
	return (
		<textbox
			BackgroundColor3={COLORS.woodDark}
			BorderSizePixel={0}
			Size={new UDim2(1, 0, 0, 40)}
			LayoutOrder={props.order ?? 0}
			ClearTextOnFocus={false}
			Font={FONTS.display}
			PlaceholderText={props.placeholder}
			PlaceholderColor3={COLORS.textMuted}
			Text={props.value}
			TextColor3={COLORS.white}
			TextSize={TEXT_SIZES.body}
			Change={{ Text: (box) => props.onChange(box.Text) }}
		>
			<uicorner CornerRadius={RADIUS.medium} />
			<uistroke Color={COLORS.outline} Thickness={STROKE.thin} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
		</textbox>
	);
}
