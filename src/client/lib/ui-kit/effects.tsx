// Small decorative layers shared by buttons, ribbons and cards. No game logic.
import React, { useBinding, useEffect } from "@rbxts/react";
import { RunService } from "@rbxts/services";
import { COLORS, RADIUS } from "./theme";

/**
 * The glossy pill across the top of a button or ribbon. Put it INSIDE the surface; give the text a higher ZIndex,
 * because children are drawn over their parent's own text.
 */
export function Gloss(props: { zIndex?: number; height?: number }) {
	return (
		<frame
			BackgroundColor3={COLORS.white}
			BorderSizePixel={0}
			Position={new UDim2(0.08, 0, 0, 3)}
			Size={new UDim2(0.84, 0, props.height ?? 0.36, 0)}
			ZIndex={props.zIndex ?? 2}
		>
			<uicorner CornerRadius={RADIUS.round} />
			<uigradient
				Rotation={90}
				Transparency={
					new NumberSequence([new NumberSequenceKeypoint(0, 0.55), new NumberSequenceKeypoint(1, 0.95)])
				}
			/>
		</frame>
	);
}

/** Seconds for one sweep plus the pause after it. */
const SHINE_PERIOD = 3.2;
/** Share of the period the sweep takes; the rest is a pause so the shine does not nag. */
const SHINE_ACTIVE = 0.45;

/**
 * A soft light band that sweeps across the main call-to-action button now and then.
 * The surface must clip its children (ClipsDescendants). Not rotated on purpose: Roblox does not clip rotated children.
 */
export function Shine(props: { zIndex?: number }) {
	const [offset, setOffset] = useBinding(2);
	useEffect(() => {
		const started = os.clock();
		const connection = RunService.Heartbeat.Connect(() => {
			const phase = ((os.clock() - started) % SHINE_PERIOD) / SHINE_PERIOD;
			setOffset(phase < SHINE_ACTIVE ? -0.5 + (phase / SHINE_ACTIVE) * 2 : 2);
		});
		return () => connection.Disconnect();
	}, [setOffset]);
	return (
		<frame
			BackgroundColor3={COLORS.white}
			BorderSizePixel={0}
			Position={offset.map((value) => new UDim2(value, 0, 0, 0))}
			Size={new UDim2(0.4, 0, 1, 0)}
			ZIndex={props.zIndex ?? 2}
		>
			<uigradient
				Transparency={
					new NumberSequence([
						new NumberSequenceKeypoint(0, 1),
						new NumberSequenceKeypoint(0.5, 0.55),
						new NumberSequenceKeypoint(1, 1),
					])
				}
			/>
		</frame>
	);
}

/**
 * Rotating light rays behind legendary rewards: six long bars (twelve rays) turning slowly.
 * The parent MUST be a CanvasGroup: ClipsDescendants does not clip rotated children, a CanvasGroup does.
 */
export function Sunburst(props: { zIndex?: number; color?: Color3 }) {
	const [angle, setAngle] = useBinding(0);
	useEffect(() => {
		const started = os.clock();
		// A full turn every 14 s, like the reference.
		const connection = RunService.Heartbeat.Connect(() => setAngle(((os.clock() - started) / 14) * 360));
		return () => connection.Disconnect();
	}, [setAngle]);
	const bars: React.Element[] = [];
	for (let i = 0; i < 6; i++) {
		bars.push(
			<frame
				key={`ray_${i}`}
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				Size={new UDim2(0, 18, 3, 0)}
				BackgroundColor3={props.color ?? Color3.fromRGB(255, 236, 130)}
				BackgroundTransparency={0.55}
				BorderSizePixel={0}
				Rotation={angle.map((value) => value + i * 30)}
				ZIndex={props.zIndex ?? 1}
			/>,
		);
	}
	return <>{bars}</>;
}
