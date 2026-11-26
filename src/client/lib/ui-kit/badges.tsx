// HUD building blocks: square stat tiles, coloured dock buttons and the round badges that stick out of capsules.
import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useState } from "@rbxts/react";
import { Gloss } from "./effects";
import { Glyph } from "./glyph";
import {
	BUTTON_RAMPS,
	ButtonVariant,
	COLORS,
	DEPTH,
	FONTS,
	RADIUS,
	RAMPS,
	Ramp,
	SPRINGS,
	STROKE,
	TEXT_SIZES,
	Tone,
	rampSequence,
	toneColor,
} from "./theme";

/** The dark block under a tile or button; the face (children) is drawn on top of it. */
function BlockFace(props: React.PropsWithChildren<{ size: number; radius: UDim }>) {
	return (
		<>
			<frame
				BackgroundColor3={COLORS.outline}
				BorderSizePixel={0}
				Position={new UDim2(0, 0, 0, DEPTH.button)}
				Size={new UDim2(1, 0, 0, props.size)}
			>
				<uicorner CornerRadius={props.radius} />
			</frame>
			{props.children}
		</>
	);
}

export const STAT_TILE_SIZE = 60;

export interface StatTileProps {
	readonly icon: string;
	/** Short value under the icon, e.g. "16" or "1/3". */
	readonly value: string;
	/** Full explanation shown on hover (PC) or tap (phone). */
	readonly tooltip: string;
	readonly tone?: Tone;
	readonly order?: number;
}

/** A square HUD tile: a big icon and a short value. The full text appears next to it on hover or tap. */
export function StatTile(props: StatTileProps) {
	const [open, setOpen] = useState(false);
	const [scale, scaleMotion] = useMotion(1);
	const show = (value: boolean) => {
		setOpen(value);
		scaleMotion.spring(value ? 1.06 : 1, SPRINGS.bouncy);
	};
	const size = STAT_TILE_SIZE;
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(0, size, 0, size + DEPTH.button)}
			LayoutOrder={props.order ?? 0}
			// Raised while the tooltip is open, so it is drawn over the neighbouring tiles.
			ZIndex={open ? 5 : 1}
		>
			<uiscale Scale={scale} />
			<BlockFace size={size} radius={RADIUS.large}>
				<textbutton
					AutoButtonColor={false}
					BackgroundColor3={COLORS.white}
					BorderSizePixel={0}
					Size={new UDim2(1, 0, 0, size)}
					Text=""
					Event={{
						MouseEnter: () => show(true),
						MouseLeave: () => show(false),
						// Phones have no hover: a tap toggles the explanation.
						Activated: () => show(!open),
					}}
				>
					<uicorner CornerRadius={RADIUS.large} />
					<uistroke
						Color={COLORS.outline}
						Thickness={STROKE.thick}
						ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
					/>
					<uigradient Rotation={90} Color={rampSequence(RAMPS.plank, open ? 0.1 : 0)} />
					<Gloss zIndex={2} height={0.3} />
					<Glyph
						icon={props.icon}
						position={new UDim2(0, 0, 0, 5)}
						size={new UDim2(1, 0, 0, 36)}
						textSize={25}
						zIndex={3}
					/>
					<textlabel
						BackgroundTransparency={1}
						Position={new UDim2(0, 4, 1, -28)}
						Size={new UDim2(1, -8, 0, 24)}
						Font={FONTS.display}
						Text={props.value}
						TextColor3={toneColor(props.tone ?? "normal")}
						TextScaled={true}
						ZIndex={3}
					>
						<uitextsizeconstraint MaxTextSize={15} MinTextSize={9} />
						<uistroke Color={COLORS.outline} Thickness={2} />
					</textlabel>
				</textbutton>
			</BlockFace>
			{open && (
				<frame
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(1, 12, 0, size / 2)}
					Size={new UDim2(0, 0, 0, 40)}
					AutomaticSize={Enum.AutomaticSize.X}
					BackgroundColor3={COLORS.outline}
					BackgroundTransparency={0.05}
					ZIndex={6}
				>
					<uicorner CornerRadius={RADIUS.medium} />
					<uistroke Color={COLORS.gold} Thickness={STROKE.thin} />
					<uipadding PaddingLeft={new UDim(0, 14)} PaddingRight={new UDim(0, 14)} />
					<textlabel
						BackgroundTransparency={1}
						Size={new UDim2(0, 0, 1, 0)}
						AutomaticSize={Enum.AutomaticSize.X}
						Font={FONTS.body}
						Text={`${props.icon}  ${props.tooltip}`}
						TextSize={TEXT_SIZES.body}
						TextColor3={COLORS.text}
						ZIndex={7}
					/>
				</frame>
			)}
		</frame>
	);
}

export const MENU_BUTTON_SIZE = 68;

export interface MenuButtonProps {
	readonly icon: string;
	readonly label: string;
	readonly onClick: () => void;
	readonly order?: number;
	readonly variant?: ButtonVariant;
}

/** A big square dock button with an emoji and its caption inside, coloured by `variant`. */
export function MenuButton(props: MenuButtonProps) {
	const [scale, scaleMotion] = useMotion(1);
	const [press, pressMotion] = useMotion(0);
	const size = MENU_BUTTON_SIZE;
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(0, size, 0, size + DEPTH.button)}
			LayoutOrder={props.order ?? 0}
		>
			<uiscale Scale={scale} />
			<BlockFace size={size} radius={RADIUS.large}>
				<textbutton
					AutoButtonColor={false}
					BackgroundColor3={COLORS.white}
					BorderSizePixel={0}
					Position={press.map((p) => new UDim2(0, 0, 0, p * (DEPTH.button - 1)))}
					Size={new UDim2(1, 0, 0, size)}
					Text=""
					Event={{
						Activated: props.onClick,
						MouseEnter: () => scaleMotion.spring(1.06, SPRINGS.bouncy),
						MouseLeave: () => {
							scaleMotion.spring(1, SPRINGS.bouncy);
							pressMotion.spring(0, SPRINGS.snappy);
						},
						MouseButton1Down: () => pressMotion.spring(1, SPRINGS.snappy),
						MouseButton1Up: () => pressMotion.spring(0, SPRINGS.snappy),
					}}
				>
					<uicorner CornerRadius={RADIUS.large} />
					<uistroke
						Color={COLORS.outline}
						Thickness={STROKE.thick}
						ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
					/>
					<uigradient Rotation={90} Color={rampSequence(BUTTON_RAMPS[props.variant ?? "secondary"])} />
					<Gloss zIndex={2} />
					<Glyph
						icon={props.icon}
						position={new UDim2(0, 0, 0, 6)}
						size={new UDim2(1, 0, 0, 46)}
						textSize={31}
						zIndex={3}
					/>
					<textlabel
						BackgroundTransparency={1}
						Position={new UDim2(0, 2, 1, -30)}
						Size={new UDim2(1, -4, 0, 24)}
						Font={FONTS.display}
						Text={props.label}
						TextColor3={COLORS.white}
						TextScaled={true}
						ZIndex={3}
					>
						<uitextsizeconstraint MaxTextSize={15} MinTextSize={9} />
						<uistroke Color={COLORS.outline} Thickness={2} />
					</textlabel>
				</textbutton>
			</BlockFace>
		</frame>
	);
}

/** A round or rounded-square badge that sticks out of the left end of a capsule (coin, backpack, target). */
export function CapsuleBadge(props: { icon: string; ramp: Ramp; size: number; round?: boolean; rotation?: number }) {
	const radius = props.round === true ? RADIUS.round : RADIUS.large;
	return (
		<frame
			AnchorPoint={new Vector2(0, 0.5)}
			Position={new UDim2(0, -16, 0.5, 0)}
			Size={new UDim2(0, props.size, 0, props.size + 4)}
			BackgroundTransparency={1}
			Rotation={props.rotation ?? 0}
			ZIndex={4}
		>
			<frame
				BackgroundColor3={COLORS.outline}
				BorderSizePixel={0}
				Position={new UDim2(0, 0, 0, 4)}
				Size={new UDim2(1, 0, 0, props.size)}
			>
				<uicorner CornerRadius={radius} />
			</frame>
			<frame BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={new UDim2(1, 0, 0, props.size)}>
				<uicorner CornerRadius={radius} />
				<uistroke Color={COLORS.outline} Thickness={STROKE.thick} />
				<uigradient Rotation={90} Color={rampSequence(props.ramp)} />
				<Glyph
					icon={props.icon}
					size={new UDim2(1, 0, 1, 0)}
					font={FONTS.display}
					textSize={math.floor(props.size * 0.5)}
					textColor={Color3.fromRGB(69, 26, 3)}
					zIndex={2}
				/>
			</frame>
		</frame>
	);
}
