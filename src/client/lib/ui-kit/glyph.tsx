// An icon that is either an emoji / text or an image. An emoji with an image in config/icons.ts (decision 045) is
// drawn as that image, so the HUD switches to a real icon pack by changing the config only.
import React from "@rbxts/react";
import { iconImage } from "shared/config/icons";

export interface GlyphProps {
	readonly icon: string;
	readonly position?: UDim2;
	readonly size: UDim2;
	readonly textSize: number;
	readonly zIndex?: number;
	readonly font?: Enum.Font;
	readonly textColor?: Color3;
}

export function isImageIcon(icon: string): boolean {
	return icon.sub(1, 13) === "rbxassetid://" || icon.sub(1, 11) === "rbxasset://";
}

export function Glyph(props: GlyphProps) {
	const image = isImageIcon(props.icon) ? props.icon : iconImage(props.icon);
	if (image !== undefined) {
		return (
			<imagelabel
				BackgroundTransparency={1}
				Position={props.position}
				Size={props.size}
				Image={image}
				ScaleType={Enum.ScaleType.Fit}
				ZIndex={props.zIndex}
			>
				<uipadding
					PaddingTop={new UDim(0.08, 0)}
					PaddingBottom={new UDim(0.08, 0)}
					PaddingLeft={new UDim(0.08, 0)}
					PaddingRight={new UDim(0.08, 0)}
				/>
			</imagelabel>
		);
	}
	return (
		<textlabel
			BackgroundTransparency={1}
			Position={props.position}
			Size={props.size}
			Font={props.font}
			Text={props.icon}
			TextSize={props.textSize}
			TextColor3={props.textColor}
			ZIndex={props.zIndex}
		/>
	);
}
