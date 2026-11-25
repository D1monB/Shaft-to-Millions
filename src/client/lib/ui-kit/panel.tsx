import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import {
	ACCENTS,
	Accent,
	COLORS,
	FONTS,
	GLASS_TRANSPARENCY,
	MIN_TOUCH,
	RADIUS,
	RAMPS,
	SPRINGS,
	STROKE,
	TEXT_SIZES,
	rampSequence,
} from "./theme";

export interface PanelProps extends React.PropsWithChildren {
	readonly title: string;
	readonly icon?: string;
	/** Neon colour of the outline and title bar; the section's colour (pets pink, auras violet/teal...). */
	readonly accent?: Accent;
	/** Pinned under the scrolling content, always visible: THE main action (buy, open). */
	readonly footer?: React.Element;
	readonly onClose: () => void;
}

/** Wider than tall: card lists scroll left-right, so a landscape phone shows a whole row. */
const MAX_SIZE = new Vector2(820, 520);
const HEADER_HEIGHT = 46;
const PADDING = 14;

/**
 * A translucent graphite panel in the middle of the screen with a thin neon outline, a compact title on the left and
 * a small close button on the right. It pops in with a small spring. The dim backdrop closes it when tapped, the
 * gesture players expect on phones.
 */
export function Panel(props: PanelProps) {
	const accent = ACCENTS[props.accent ?? "orange"];
	const [scale, scaleMotion] = useMotion(0.9);
	const [fade, fadeMotion] = useMotion(1);
	useEffect(() => {
		scaleMotion.spring(1, SPRINGS.snappy);
		fadeMotion.spring(0.55, SPRINGS.smooth);
	}, [scaleMotion, fadeMotion]);

	const title = props.icon !== undefined ? `${props.icon}  ${props.title}` : props.title;
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
				Position={new UDim2(0.5, 0, 0.5, 0)}
				Size={new UDim2(0.92, 0, 0.86, 0)}
				BackgroundTransparency={1}
			>
				<uiscale Scale={scale} />
				<uisizeconstraint MaxSize={MAX_SIZE} />
				{/* A faint halo of the accent around the board: reads as a neon glow without images. */}
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(1, 10, 1, 10)}
					BackgroundColor3={accent}
					BackgroundTransparency={0.85}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(0, 22)} />
				</frame>
				{/* The glass. Separate from the outlined frame: a UIGradient also tints a sibling UIStroke. */}
				<frame
					BackgroundColor3={COLORS.white}
					BackgroundTransparency={GLASS_TRANSPARENCY}
					BorderSizePixel={0}
					Size={new UDim2(1, 0, 1, 0)}
				>
					<uicorner CornerRadius={RADIUS.xlarge} />
					<uigradient Rotation={90} Color={rampSequence(RAMPS.panel)} />
				</frame>
				<frame BackgroundTransparency={1} BorderSizePixel={0} Size={new UDim2(1, 0, 1, 0)}>
					<uicorner CornerRadius={RADIUS.xlarge} />
					<uistroke Color={accent} Thickness={STROKE.thick} Transparency={0.15} />
					<uipadding
						PaddingTop={new UDim(0, 8)}
						PaddingBottom={new UDim(0, PADDING)}
						PaddingLeft={new UDim(0, PADDING)}
						PaddingRight={new UDim(0, PADDING)}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<Header title={title} accent={accent} onClose={props.onClose} />
					<scrollingframe
						BackgroundTransparency={1}
						BorderSizePixel={0}
						Size={new UDim2(1, 0, 0, 0)}
						CanvasSize={new UDim2(0, 0, 0, 0)}
						AutomaticCanvasSize={Enum.AutomaticSize.Y}
						ScrollingDirection={Enum.ScrollingDirection.Y}
						ScrollBarThickness={4}
						ScrollBarImageColor3={accent}
						LayoutOrder={2}
					>
						{/* Takes all the height the header and the footer leave. */}
						<uiflexitem FlexMode={Enum.UIFlexMode.Fill} />
						<uipadding PaddingRight={new UDim(0, 8)} PaddingBottom={new UDim(0, 4)} />
						<uilistlayout Padding={new UDim(0, 10)} SortOrder={Enum.SortOrder.LayoutOrder} />
						{props.children}
					</scrollingframe>
					{props.footer !== undefined && (
						<frame
							BackgroundTransparency={1}
							Size={new UDim2(1, 0, 0, 0)}
							AutomaticSize={Enum.AutomaticSize.Y}
							LayoutOrder={3}
						>
							<uilistlayout Padding={new UDim(0, 6)} SortOrder={Enum.SortOrder.LayoutOrder} />
							{props.footer}
						</frame>
					)}
				</frame>
			</frame>
		</frame>
	);
}

/** Title on the left with an accent bar, close button on the right, a thin accent line under them. */
function Header(props: { title: string; accent: Color3; onClose: () => void }) {
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, HEADER_HEIGHT)} LayoutOrder={1}>
			<frame
				AnchorPoint={new Vector2(0, 0.5)}
				Position={new UDim2(0, 0, 0.5, -2)}
				Size={new UDim2(0, 4, 0, 24)}
				BackgroundColor3={props.accent}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={RADIUS.round} />
			</frame>
			<textlabel
				BackgroundTransparency={1}
				Position={new UDim2(0, 14, 0, 0)}
				Size={new UDim2(1, -(14 + MIN_TOUCH + 8), 1, -4)}
				Font={FONTS.display}
				Text={props.title}
				TextSize={TEXT_SIZES.title}
				TextColor3={COLORS.text}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextTruncate={Enum.TextTruncate.AtEnd}
			/>
			<CloseButton onClose={props.onClose} />
			<frame
				AnchorPoint={new Vector2(0, 1)}
				Position={new UDim2(0, 0, 1, 0)}
				Size={new UDim2(1, 0, 0, 1)}
				BackgroundColor3={props.accent}
				BackgroundTransparency={0.6}
				BorderSizePixel={0}
			/>
		</frame>
	);
}

function CloseButton(props: { onClose: () => void }) {
	const [scale, scaleMotion] = useMotion(1);
	const size = MIN_TOUCH - 6;
	return (
		<textbutton
			AnchorPoint={new Vector2(1, 0.5)}
			Position={new UDim2(1, 0, 0.5, -2)}
			Size={new UDim2(0, size, 0, size)}
			AutoButtonColor={false}
			BackgroundColor3={COLORS.woodLight}
			BackgroundTransparency={0.2}
			BorderSizePixel={0}
			Text=""
			Event={{
				Activated: props.onClose,
				MouseEnter: () => scaleMotion.spring(1.08, SPRINGS.bouncy),
				MouseLeave: () => scaleMotion.spring(1, SPRINGS.bouncy),
			}}
		>
			<uiscale Scale={scale} />
			<uicorner CornerRadius={RADIUS.round} />
			<uistroke Color={COLORS.danger} Thickness={STROKE.thin} Transparency={0.3} />
			{/* The cross is drawn with two bars: BuilderSans has no "✕" glyph and showed an empty box. */}
			{[45, -45].map((angle) => (
				<frame
					key={`bar_${angle}`}
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(0, 16, 0, 3)}
					Rotation={angle}
					BackgroundColor3={COLORS.text}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={RADIUS.round} />
				</frame>
			))}
		</textbutton>
	);
}
