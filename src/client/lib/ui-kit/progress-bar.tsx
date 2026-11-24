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

/** A bar that slides smoothly to the new value instead of jumping. */
export function ProgressBar(props: ProgressBarProps) {
	const target = clampFraction(props.progress);
	const [fill, fillMotion] = useMotion(target);
	useEffect(() => {
		fillMotion.spring(target, SPRINGS.smooth);
	}, [target, fillMotion]);

	const height = props.height ?? 14;
	return (
		<frame
			BackgroundColor3={COLORS.woodDark}
			Size={new UDim2(1, 0, 0, height)}
			LayoutOrder={props.order ?? 0}
			ClipsDescendants={false}
		>
			<uicorner CornerRadius={RADIUS.round} />
			<uistroke Color={COLORS.outline} Thickness={STROKE.thin} />
			<frame
				BackgroundColor3={props.color ?? COLORS.success}
				Size={fill.map((value) => new UDim2(value, 0, 1, 0))}
				Visible={fill.map((value) => value > 0.001)}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={RADIUS.round} />
				<uigradient
					Rotation={90}
					Color={
						new ColorSequence([
							new ColorSequenceKeypoint(0, COLORS.white),
							new ColorSequenceKeypoint(1, Color3.fromRGB(190, 190, 190)),
						])
					}
				/>
			</frame>
			{props.text !== undefined && (
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(1, 0, 1, 0)}
					Font={FONTS.display}
					Text={props.text}
					TextColor3={COLORS.text}
					TextSize={math.max(12, height - 4)}
					ZIndex={2}
				>
					<uistroke Color={COLORS.outline} Thickness={1.5} />
				</textlabel>
			)}
		</frame>
	);
}
