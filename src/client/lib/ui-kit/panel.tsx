import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import { TextService } from "@rbxts/services";
import { Gloss } from "./effects";
import { COLORS, DEPTH, FONTS, RADIUS, RAMPS, SPRINGS, STROKE, TEXT_SIZES, rampSequence } from "./theme";

export interface PanelProps extends React.PropsWithChildren {
	readonly title: string;
	readonly icon?: string;
	readonly onClose: () => void;
}

const MAX_SIZE = new Vector2(660, 740);
const RIBBON_HEIGHT = 58;
/** How far the title ribbon sticks out above the board. */
const RIBBON_OVERHANG = 30;
/** Where the content starts: below the part of the ribbon that hangs over the board. */
const CONTENT_TOP = RIBBON_HEIGHT - RIBBON_OVERHANG + 20;
const CLOSE_SIZE = 58;

/**
 * A timber board in the middle of the screen with a gold ribbon title over its top edge and a big red close button.
 * It pops in with a small spring. The dim backdrop behind it closes the panel when tapped,
 * which is the gesture players expect on phones.
 */
export function Panel(props: PanelProps) {
	const [scale, scaleMotion] = useMotion(0.85);
	const [fade, fadeMotion] = useMotion(1);
	useEffect(() => {
		scaleMotion.spring(1, SPRINGS.bouncy);
		fadeMotion.spring(0.45, SPRINGS.smooth);
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
				Position={new UDim2(0.5, 0, 0.5, RIBBON_OVERHANG / 2)}
				Size={new UDim2(0.94, 0, 0.8, 0)}
				BackgroundTransparency={1}
			>
				<uiscale Scale={scale} />
				<uisizeconstraint MaxSize={MAX_SIZE} />
				{/* The dark block under the board. */}
				<frame
					BackgroundColor3={COLORS.outline}
					BorderSizePixel={0}
					Position={new UDim2(0, 0, 0, DEPTH.panel)}
					Size={new UDim2(1, 0, 1, 0)}
				>
					<uicorner CornerRadius={RADIUS.xlarge} />
				</frame>
				<frame BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={new UDim2(1, 0, 1, 0)}>
					<uicorner CornerRadius={RADIUS.xlarge} />
					<uistroke Color={COLORS.outline} Thickness={STROKE.heavy} />
					<uigradient Rotation={90} Color={rampSequence(RAMPS.panel)} />
					{/* A thin light line along the top edge: the board catches the light like in the reference. */}
					<frame
						BackgroundColor3={COLORS.white}
						BackgroundTransparency={0.78}
						BorderSizePixel={0}
						Position={new UDim2(0, 18, 0, 4)}
						Size={new UDim2(1, -36, 0, 3)}
					>
						<uicorner CornerRadius={RADIUS.round} />
					</frame>
					<scrollingframe
						BackgroundTransparency={1}
						BorderSizePixel={0}
						Position={new UDim2(0, 0, 0, CONTENT_TOP)}
						Size={new UDim2(1, 0, 1, -(CONTENT_TOP + 8))}
						CanvasSize={new UDim2(0, 0, 0, 0)}
						AutomaticCanvasSize={Enum.AutomaticSize.Y}
						ScrollingDirection={Enum.ScrollingDirection.Y}
						ScrollBarThickness={8}
						ScrollBarImageColor3={COLORS.gold}
					>
						<uipadding
							PaddingTop={new UDim(0, 6)}
							PaddingBottom={new UDim(0, 18)}
							PaddingLeft={new UDim(0, 18)}
							PaddingRight={new UDim(0, 20)}
						/>
						<uilistlayout Padding={new UDim(0, 12)} SortOrder={Enum.SortOrder.LayoutOrder} />
						{props.children}
					</scrollingframe>
				</frame>
				<Ribbon title={props.title} icon={props.icon} />
				<CloseButton onClose={props.onClose} />
			</frame>
		</frame>
	);
}

/** The gold title over the top edge. Its width is measured from the text so the block under it can match. */
function Ribbon(props: { title: string; icon?: string }) {
	const text = props.icon !== undefined ? `${props.icon}  ${props.title}` : props.title;
	const textWidth = TextService.GetTextSize(text, TEXT_SIZES.title, FONTS.display, new Vector2(2000, 200)).X;
	const width = textWidth + 64;
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, -RIBBON_OVERHANG)}
			Size={new UDim2(0, width, 0, RIBBON_HEIGHT + DEPTH.button)}
			BackgroundTransparency={1}
			ZIndex={5}
		>
			<frame
				BackgroundColor3={COLORS.outline}
				BorderSizePixel={0}
				Position={new UDim2(0, 0, 0, DEPTH.button)}
				Size={new UDim2(1, 0, 0, RIBBON_HEIGHT)}
			>
				<uicorner CornerRadius={RADIUS.large} />
			</frame>
			<frame BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={new UDim2(1, 0, 0, RIBBON_HEIGHT)}>
				<uicorner CornerRadius={RADIUS.large} />
				<uistroke Color={COLORS.outline} Thickness={STROKE.thick} />
				<uigradient Rotation={90} Color={rampSequence(RAMPS.ribbon)} />
				<Gloss zIndex={2} />
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(1, 0, 1, 0)}
					Font={FONTS.display}
					Text={text}
					TextSize={TEXT_SIZES.title}
					TextColor3={COLORS.white}
					ZIndex={3}
				>
					<uistroke Color={COLORS.outline} Thickness={2.5} />
				</textlabel>
			</frame>
		</frame>
	);
}

function CloseButton(props: { onClose: () => void }) {
	const [scale, scaleMotion] = useMotion(1);
	return (
		<frame
			AnchorPoint={new Vector2(1, 0)}
			// Inside the board's right edge: on phones the board is almost as wide as the screen, and a button hanging
			// outside it was cut off.
			Position={new UDim2(1, -10, 0, -24)}
			Size={new UDim2(0, CLOSE_SIZE, 0, CLOSE_SIZE + DEPTH.button)}
			BackgroundTransparency={1}
			ZIndex={6}
		>
			<uiscale Scale={scale} />
			<frame
				BackgroundColor3={COLORS.outline}
				BorderSizePixel={0}
				Position={new UDim2(0, 0, 0, DEPTH.button)}
				Size={new UDim2(1, 0, 0, CLOSE_SIZE)}
			>
				<uicorner CornerRadius={RADIUS.medium} />
			</frame>
			<textbutton
				AutoButtonColor={false}
				BackgroundColor3={COLORS.white}
				BorderSizePixel={0}
				Size={new UDim2(1, 0, 0, CLOSE_SIZE)}
				Text=""
				Event={{
					Activated: props.onClose,
					MouseEnter: () => scaleMotion.spring(1.1, SPRINGS.bouncy),
					MouseLeave: () => scaleMotion.spring(1, SPRINGS.bouncy),
				}}
			>
				<uicorner CornerRadius={RADIUS.medium} />
				<uistroke
					Color={COLORS.outline}
					Thickness={STROKE.thick}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				<uigradient Rotation={90} Color={rampSequence(RAMPS.close)} />
				<Gloss zIndex={2} />
				{/* The cross is drawn with two bars: BuilderSans has no "✕" glyph and showed an empty box. */}
				{[45, -45].map((angle) => (
					<frame
						key={`bar_${angle}`}
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(0.5, 0, 0.5, 0)}
						Size={new UDim2(0, 30, 0, 8)}
						Rotation={angle}
						BackgroundColor3={COLORS.white}
						BorderSizePixel={0}
						ZIndex={3}
					>
						<uicorner CornerRadius={RADIUS.round} />
						<uistroke Color={COLORS.outline} Thickness={2} />
					</frame>
				))}
			</textbutton>
		</frame>
	);
}
