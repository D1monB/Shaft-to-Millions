// How ores look in the UI: a coloured square with an icon and a count, plus a drawn arrow for "ore → product".
// The colour comes from the ore config.
import React from "@rbxts/react";
import { ORES, OreId } from "shared/config/ores";
import { COLORS, FONTS, RADIUS, STROKE, rampSequence } from "./ui-kit";

// Each ore has its own glyph, not only its own colour. Only emoji from old Unicode versions: newer ones (e.g. the
// rock, Unicode 13) are missing from the Roblox emoji font and draw an empty square.
const ORE_ICONS: { readonly [K in OreId]: string } = {
	copper: "🔶",
	iron: "🔩",
	silver: "⚪",
	gold: "⭐",
	titanium: "🔷",
	iridium: "💎",
};

function colorOf(id: OreId): Color3 {
	const [r, g, b] = ORES[id].color;
	return Color3.fromRGB(r, g, b);
}

export function resourceIcon(id: OreId): string {
	return ORE_ICONS[id];
}

export interface ResourceTileProps {
	readonly id: OreId;
	/** Side of the square in pixels. */
	readonly size: number;
	/** Small badge in the corner, e.g. "×3". */
	readonly badge?: string;
	/** A line under the tile, e.g. "3/5" of what is needed. */
	readonly caption?: string;
	readonly captionColor?: Color3;
	/** Darkened: an empty or not yet available slot. */
	readonly dimmed?: boolean;
	/** 0..1: a light fill rising from the bottom (the craft in progress). */
	readonly fill?: number;
	readonly order?: number;
}

/** One resource as a coloured square. With a caption the tile is taller by the caption line. */
export function ResourceTile(props: ResourceTileProps) {
	const color = colorOf(props.id);
	const ramp = { top: color.Lerp(COLORS.white, 0.35), mid: color, bottom: color.Lerp(COLORS.black, 0.4) };
	const captionHeight = props.caption !== undefined ? 20 : 0;
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(0, props.size, 0, props.size + captionHeight)}
			LayoutOrder={props.order ?? 0}
		>
			<frame BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={new UDim2(0, props.size, 0, props.size)}>
				<uicorner CornerRadius={RADIUS.medium} />
				<uigradient Rotation={90} Color={rampSequence(ramp)} />
				<uistroke Color={COLORS.outline} Thickness={STROKE.thick} />
				{props.fill !== undefined && (
					<frame
						AnchorPoint={new Vector2(0, 1)}
						BackgroundColor3={COLORS.white}
						BackgroundTransparency={0.6}
						BorderSizePixel={0}
						Position={UDim2.fromScale(0, 1)}
						Size={UDim2.fromScale(1, math.clamp(props.fill, 0, 1))}
						ZIndex={2}
					>
						<uicorner CornerRadius={RADIUS.medium} />
					</frame>
				)}
				<textlabel
					BackgroundTransparency={1}
					Size={UDim2.fromScale(1, 1)}
					Text={resourceIcon(props.id)}
					TextScaled={true}
					ZIndex={3}
				>
					<uipadding
						PaddingTop={new UDim(0.18, 0)}
						PaddingBottom={new UDim(0.18, 0)}
						PaddingLeft={new UDim(0.18, 0)}
						PaddingRight={new UDim(0.18, 0)}
					/>
				</textlabel>
				{props.badge !== undefined && (
					<textlabel
						AnchorPoint={new Vector2(1, 1)}
						BackgroundTransparency={1}
						Position={new UDim2(1, -3, 1, -1)}
						Size={new UDim2(0, 0, 0, 18)}
						AutomaticSize={Enum.AutomaticSize.X}
						Font={FONTS.display}
						Text={props.badge}
						TextColor3={COLORS.white}
						TextSize={16}
						ZIndex={4}
					>
						<uistroke Color={COLORS.outline} Thickness={2} />
					</textlabel>
				)}
				{props.dimmed === true && (
					<frame
						BackgroundColor3={COLORS.black}
						BackgroundTransparency={0.5}
						Size={UDim2.fromScale(1, 1)}
						ZIndex={5}
					>
						<uicorner CornerRadius={RADIUS.medium} />
					</frame>
				)}
			</frame>
			{props.caption !== undefined && (
				<textlabel
					BackgroundTransparency={1}
					Position={new UDim2(0, -6, 0, props.size + 2)}
					Size={new UDim2(1, 12, 0, captionHeight - 2)}
					Font={FONTS.display}
					Text={props.caption}
					TextColor3={props.captionColor ?? COLORS.text}
					TextSize={15}
				>
					<uistroke Color={COLORS.outline} Thickness={1.5} />
				</textlabel>
			)}
		</frame>
	);
}

/** A right-pointing arrow drawn from three bars, because the UI font has no arrow glyph we can rely on. */
export function DrawnArrow(props: { size: number; order?: number; color?: Color3 }) {
	const color = props.color ?? COLORS.gold;
	const thick = math.max(4, math.floor(props.size / 6));
	const head = math.floor(props.size * 0.42);
	const bar = (position: UDim2, size: UDim2, rotation: number, anchor: Vector2) => (
		<frame
			AnchorPoint={anchor}
			BackgroundColor3={color}
			BorderSizePixel={0}
			Position={position}
			Rotation={rotation}
			Size={size}
		>
			<uicorner CornerRadius={new UDim(1, 0)} />
			<uistroke Color={COLORS.outline} Thickness={1.5} />
		</frame>
	);
	// Rotation turns a frame around its centre, so each half of the head is centred half its length back from the tip.
	const tipX = props.size * 0.9;
	const tipY = props.size / 2;
	const angle = math.rad(40);
	const back = (head / 2) * math.cos(angle);
	const lift = (head / 2) * math.sin(angle);
	const centre = new Vector2(0.5, 0.5);
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(0, props.size, 0, props.size)} LayoutOrder={props.order ?? 0}>
			{bar(
				new UDim2(0, props.size * 0.08, 0, tipY),
				new UDim2(0, props.size * 0.78, 0, thick),
				0,
				new Vector2(0, 0.5),
			)}
			{bar(new UDim2(0, tipX - back, 0, tipY - lift), new UDim2(0, head, 0, thick), 40, centre)}
			{bar(new UDim2(0, tipX - back, 0, tipY + lift), new UDim2(0, head, 0, thick), -40, centre)}
		</frame>
	);
}
