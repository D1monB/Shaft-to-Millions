import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import { COLORS, FONTS, RADIUS, SPRINGS, STROKE, TEXT_SIZES } from "./theme";

export interface PanelProps extends React.PropsWithChildren {
	readonly title: string;
	readonly icon?: string;
	readonly onClose: () => void;
}

const MAX_SIZE = new Vector2(660, 740);
/** The title sign hangs over the top edge; content starts below it. */
const SIGN_OVERHANG = 28;

/**
 * A timber board in the middle of the screen with a gold title sign and a close button.
 * It pops in with a small spring. The dim backdrop behind it closes the panel when tapped,
 * which is the gesture players expect on phones.
 */
export function Panel(props: PanelProps) {
	const [scale, scaleMotion] = useMotion(0.85);
	const [fade, fadeMotion] = useMotion(1);
	useEffect(() => {
		scaleMotion.spring(1, SPRINGS.bouncy);
		fadeMotion.spring(0.55, SPRINGS.smooth);
	}, [scaleMotion, fadeMotion]);

	return (
		<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 1, 0)} ZIndex={10}>
			<textbutton
				Text=""
				AutoButtonColor={false}
				BackgroundColor3={COLORS.black}
				BackgroundTransparency={fade}
				Size={new UDim2(1, 0, 1, 0)}
				Event={{ Activated: props.onClose }}
			/>
			<frame
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, SIGN_OVERHANG / 2)}
				Size={new UDim2(0.94, 0, 0.8, 0)}
				BackgroundColor3={COLORS.woodDark}
			>
				<uiscale Scale={scale} />
				<uisizeconstraint MaxSize={MAX_SIZE} />
				<uicorner CornerRadius={RADIUS.large} />
				<uistroke Color={COLORS.outline} Thickness={STROKE.heavy} />
				{/* Darker towards the bottom: reads as a lit board. */}
				<uigradient
					Rotation={90}
					Color={
						new ColorSequence([
							new ColorSequenceKeypoint(0, COLORS.white),
							new ColorSequenceKeypoint(1, Color3.fromRGB(170, 170, 170)),
						])
					}
				/>

				<TitleSign title={props.title} icon={props.icon} />
				<CloseButton onClose={props.onClose} />

				<scrollingframe
					BackgroundTransparency={1}
					BorderSizePixel={0}
					Position={new UDim2(0, 0, 0, SIGN_OVERHANG + 14)}
					Size={new UDim2(1, 0, 1, -(SIGN_OVERHANG + 20))}
					CanvasSize={new UDim2(0, 0, 0, 0)}
					AutomaticCanvasSize={Enum.AutomaticSize.Y}
					ScrollingDirection={Enum.ScrollingDirection.Y}
					ScrollBarThickness={6}
					ScrollBarImageColor3={COLORS.gold}
				>
					<uipadding
						PaddingTop={new UDim(0, 6)}
						PaddingBottom={new UDim(0, 16)}
						PaddingLeft={new UDim(0, 16)}
						PaddingRight={new UDim(0, 18)}
					/>
					<uilistlayout Padding={new UDim(0, 10)} SortOrder={Enum.SortOrder.LayoutOrder} />
					{props.children}
				</scrollingframe>
			</frame>
		</frame>
	);
}

function TitleSign(props: { title: string; icon?: string }) {
	const text = props.icon !== undefined ? `${props.icon}  ${props.title}` : props.title;
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, -SIGN_OVERHANG)}
			Size={new UDim2(0, 0, 0, 58)}
			AutomaticSize={Enum.AutomaticSize.X}
			BackgroundColor3={COLORS.gold}
			ZIndex={3}
		>
			<uicorner CornerRadius={RADIUS.medium} />
			<uistroke Color={COLORS.outline} Thickness={STROKE.heavy} />
			<uipadding PaddingLeft={new UDim(0, 22)} PaddingRight={new UDim(0, 22)} />
			<uigradient
				Rotation={90}
				Color={
					new ColorSequence([
						new ColorSequenceKeypoint(0, COLORS.white),
						new ColorSequenceKeypoint(0.5, COLORS.white),
						new ColorSequenceKeypoint(1, Color3.fromRGB(215, 195, 160)),
					])
				}
			/>
			<textlabel
				BackgroundTransparency={1}
				Size={new UDim2(0, 0, 1, 0)}
				AutomaticSize={Enum.AutomaticSize.X}
				Font={FONTS.display}
				Text={text}
				TextSize={TEXT_SIZES.title}
				TextColor3={COLORS.textDark}
				ZIndex={3}
			/>
		</frame>
	);
}

function CloseButton(props: { onClose: () => void }) {
	const [scale, scaleMotion] = useMotion(1);
	return (
		<textbutton
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={new UDim2(1, -10, 0, 10)}
			Size={new UDim2(0, 56, 0, 56)}
			BackgroundColor3={COLORS.canyon}
			AutoButtonColor={false}
			Font={FONTS.display}
			Text="✕"
			TextSize={30}
			TextColor3={COLORS.text}
			ZIndex={4}
			Event={{
				Activated: props.onClose,
				MouseEnter: () => scaleMotion.spring(1.1, SPRINGS.bouncy),
				MouseLeave: () => scaleMotion.spring(1, SPRINGS.bouncy),
			}}
		>
			<uiscale Scale={scale} />
			<uicorner CornerRadius={RADIUS.medium} />
			<uistroke Color={COLORS.outline} Thickness={STROKE.heavy} ApplyStrokeMode={Enum.ApplyStrokeMode.Border} />
		</textbutton>
	);
}
