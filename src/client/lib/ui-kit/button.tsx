import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useState } from "@rbxts/react";
import {
	BUTTON_COLORS,
	ButtonVariant,
	COLORS,
	DISABLED_BUTTON,
	FONTS,
	MIN_TOUCH,
	RADIUS,
	SPRINGS,
	STROKE,
	TEXT_SIZES,
} from "./theme";

export interface ButtonProps {
	readonly text: string;
	readonly onClick: () => void;
	readonly variant?: ButtonVariant;
	readonly disabled?: boolean;
	readonly order?: number;
	/** Width; defaults to the full width of the parent. */
	readonly width?: UDim;
	readonly height?: number;
	readonly textSize?: number;
}

/** Height of the darker "side" under the face: the button looks like a block that can be pressed in. */
const DEPTH = 5;
const GLOSS = Color3.fromRGB(205, 205, 205);
const GLOSS_HOVER = Color3.fromRGB(235, 235, 235);

/**
 * Chunky 3D button. The face springs down when pressed and grows a little on hover,
 * so every press feels physical. A disabled button stays visible (grey) so the player sees what exists.
 */
export function Button(props: ButtonProps) {
	const disabled = props.disabled === true;
	const colors = disabled ? DISABLED_BUTTON : BUTTON_COLORS[props.variant ?? "primary"];
	const height = math.max(props.height ?? MIN_TOUCH, MIN_TOUCH);
	const [hovered, setHovered] = useState(false);
	const [press, pressMotion] = useMotion(0);
	const [scale, scaleMotion] = useMotion(1);

	const setPressed = (pressed: boolean) => {
		pressMotion.spring(pressed && !disabled ? 1 : 0, SPRINGS.snappy);
	};
	const setHover = (value: boolean) => {
		setHovered(value);
		scaleMotion.spring(value && !disabled ? 1.03 : 1, SPRINGS.bouncy);
	};

	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(props.width ?? new UDim(1, 0), new UDim(0, height + DEPTH))}
			LayoutOrder={props.order ?? 0}
		>
			<uiscale Scale={scale} />
			{/* The side: a darker block under the face. */}
			<frame
				BackgroundColor3={colors.side}
				Position={new UDim2(0, 0, 0, DEPTH)}
				Size={new UDim2(1, 0, 0, height)}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={RADIUS.medium} />
				<uistroke Color={COLORS.outline} Thickness={STROKE.thick} />
			</frame>
			<textbutton
				AutoButtonColor={false}
				BackgroundColor3={colors.face}
				BorderSizePixel={0}
				Position={press.map((p) => new UDim2(0, 0, 0, p * (DEPTH - 1)))}
				Size={new UDim2(1, 0, 0, height)}
				Font={FONTS.display}
				Text={props.text}
				TextColor3={colors.text}
				TextSize={props.textSize ?? TEXT_SIZES.body}
				TextWrapped={true}
				Active={!disabled}
				Event={{
					Activated: () => {
						if (!disabled) {
							props.onClick();
						}
					},
					MouseButton1Down: () => setPressed(true),
					MouseButton1Up: () => setPressed(false),
					MouseEnter: () => setHover(true),
					MouseLeave: () => {
						setPressed(false);
						setHover(false);
					},
				}}
			>
				<uicorner CornerRadius={RADIUS.medium} />
				<uistroke
					Color={COLORS.outline}
					Thickness={STROKE.thick}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} />
				{/* The lower half is slightly darker (a gradient multiplies colours): a cheap "block" look
				    without images. Hover lightens it so the button reacts on PC. */}
				<uigradient
					Rotation={90}
					Color={
						new ColorSequence([
							new ColorSequenceKeypoint(0, COLORS.white),
							new ColorSequenceKeypoint(0.5, COLORS.white),
							new ColorSequenceKeypoint(1, hovered && !disabled ? GLOSS_HOVER : GLOSS),
						])
					}
				/>
			</textbutton>
		</frame>
	);
}
