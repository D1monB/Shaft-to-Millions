import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useState } from "@rbxts/react";
import { Gloss, Shine } from "./effects";
import {
	BUTTON_RAMPS,
	ButtonVariant,
	COLORS,
	DEPTH,
	DISABLED_RAMP,
	DISABLED_TEXT,
	FONTS,
	MIN_TOUCH,
	RADIUS,
	SPRINGS,
	STROKE,
	TEXT_SIZES,
	rampSequence,
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
	/** A light band sweeps across now and then: only for THE main action of a panel (buy, open). */
	readonly shine?: boolean;
}

/**
 * Chunky 3D button: a gradient face with a gloss on top, a dark block under it, white outlined text.
 * The face springs down onto the block when pressed and the whole button grows a little on hover,
 * so every press feels physical. A disabled button stays visible (slate) so the player sees what exists.
 */
export function Button(props: ButtonProps) {
	const disabled = props.disabled === true;
	const ramp = disabled ? DISABLED_RAMP : BUTTON_RAMPS[props.variant ?? "primary"];
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
			Size={new UDim2(props.width ?? new UDim(1, 0), new UDim(0, height + DEPTH.button))}
			LayoutOrder={props.order ?? 0}
		>
			<uiscale Scale={scale} />
			{/* The dark block under the face. */}
			<frame
				BackgroundColor3={COLORS.outline}
				BorderSizePixel={0}
				Position={new UDim2(0, 0, 0, DEPTH.button)}
				Size={new UDim2(1, 0, 0, height)}
			>
				<uicorner CornerRadius={RADIUS.medium} />
			</frame>
			<textbutton
				AutoButtonColor={false}
				BackgroundColor3={COLORS.white}
				BorderSizePixel={0}
				Position={press.map((p) => new UDim2(0, 0, 0, p * (DEPTH.button - 1)))}
				Size={new UDim2(1, 0, 0, height)}
				Text=""
				ClipsDescendants={props.shine === true && !disabled}
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
				{/* A white face times the gradient shows the ramp exactly; hover lifts it toward white. */}
				<uigradient Rotation={90} Color={rampSequence(ramp, hovered && !disabled ? 0.12 : 0)} />
				<Gloss zIndex={2} />
				{props.shine === true && !disabled && <Shine zIndex={2} />}
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(1, -16, 1, 0)}
					Position={new UDim2(0, 8, 0, 0)}
					Font={FONTS.display}
					Text={props.text}
					TextColor3={disabled ? DISABLED_TEXT : COLORS.white}
					TextSize={props.textSize ?? TEXT_SIZES.body}
					TextWrapped={true}
					ZIndex={3}
				>
					<uistroke Color={COLORS.outline} Thickness={2} />
				</textlabel>
			</textbutton>
		</frame>
	);
}
