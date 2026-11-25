import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import { clampFraction } from "shared/lib/format";
import { COLORS, FONTS, RADIUS, SPRINGS, STROKE } from "./theme";

export interface ProgressBarProps {
	/** 0..1; NaN and out-of-range values are clamped. */
	readonly progress: number;
	readonly color?: Color3;
	readonly order?: number;
	readonly height?: number;
	/** Optional text drawn on top of the bar (e.g. "12/25"). */
	readonly text?: string;
}

/** The empty part of every bar. */
const TRACK = Color3.fromRGB(22, 12, 7);

/** A bar that slides smoothly to the new value instead of jumping. */
export function ProgressBar(props: ProgressBarProps) {
	const target = clampFraction(props.progress);
	const [fill, fillMotion] = useMotion(target);
	useEffect(() => {
		fillMotion.spring(target, SPRINGS.smooth);
	}, [target, fillMotion]);

	const height = props.height ?? 16;
	const color = props.color ?? COLORS.success;
	return (
		<frame
			BackgroundColor3={TRACK}
			Size={new UDim2(1, 0, 0, height)}
			LayoutOrder={props.order ?? 0}
			ClipsDescendants={false}
		>
			<uicorner CornerRadius={RADIUS.round} />
			<uistroke Color={COLORS.outline} Thickness={STROKE.thin} />
			<frame
				BackgroundColor3={COLORS.white}
				Size={fill.map((value) => new UDim2(value, 0, 1, 0))}
				Visible={fill.map((value) => value > 0.001)}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={RADIUS.round} />
				{/* Darker on the left, lighter on the right, like a glowing fill. */}
				<uigradient
					Color={
						new ColorSequence([
							new ColorSequenceKeypoint(0, color.Lerp(COLORS.black, 0.15)),
							new ColorSequenceKeypoint(1, color.Lerp(COLORS.white, 0.25)),
						])
					}
				/>
				{/* The light top half. */}
				<frame
					BackgroundColor3={COLORS.white}
					BackgroundTransparency={0.7}
					BorderSizePixel={0}
					Position={new UDim2(0, 4, 0, 1)}
					Size={new UDim2(1, -8, 0.45, 0)}
				>
					<uicorner CornerRadius={RADIUS.round} />
				</frame>
			</frame>
			{props.text !== undefined && (
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(1, 0, 1, 0)}
					Font={FONTS.display}
					Text={props.text}
					TextColor3={COLORS.white}
					TextSize={math.max(14, height - 4)}
					ZIndex={2}
				>
					<uistroke Color={COLORS.outline} Thickness={2} />
				</textlabel>
			)}
		</frame>
	);
}
