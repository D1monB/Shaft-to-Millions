// Visual theme of the whole UI: "juicy" 2.5D cartoon style (thick dark outlines, a dark block under every button and
// panel, top-to-bottom gradients, a glossy highlight), in mine timber, gold and red-canyon colours.
// Components read colours and fonts only from here, so a restyle is a change in one file.

function rgb(r: number, g: number, b: number): Color3 {
	return Color3.fromRGB(r, g, b);
}

export const COLORS = {
	// Timber: panels are dark planks; cards inside them are darker wells.
	woodDark: rgb(54, 34, 22),
	wood: rgb(86, 54, 33),
	woodLight: rgb(122, 80, 48),
	/** Inset wells inside panels (lists, card grids). */
	well: rgb(33, 18, 10),
	/** Every outline and every "3D" shadow block uses this one colour. */
	outline: rgb(27, 17, 12),

	gold: rgb(255, 196, 61),
	goldDark: rgb(186, 120, 18),
	canyon: rgb(219, 92, 52),
	canyonDark: rgb(146, 50, 26),
	crystal: rgb(92, 205, 255),
	crystalDark: rgb(30, 120, 180),
	success: rgb(112, 214, 88),
	successDark: rgb(52, 140, 40),
	stone: rgb(132, 118, 108),
	stoneDark: rgb(84, 74, 66),

	text: rgb(255, 246, 230),
	textMuted: rgb(222, 190, 150),
	textDark: rgb(48, 28, 14),
	danger: rgb(255, 110, 90),
	white: rgb(255, 255, 255),
	black: rgb(0, 0, 0),
};

/** The player's own colour (plot border, accents). Until plots exist everyone is gold. */
export const DEFAULT_PLAYER_COLOR = COLORS.gold;

/**
 * BuilderSans has Ukrainian letters (FredokaOne does not and silently fell back to another font).
 * Chosen after comparing fonts in the UI showcase, see docs/decisions.md 018.
 */
export const FONTS = {
	/** Titles, numbers, buttons: the heaviest weight, always with an outline. */
	display: Enum.Font.BuilderSansExtraBold,
	/** Readable body text. */
	body: Enum.Font.BuilderSansBold,
	bodyBold: Enum.Font.BuilderSansExtraBold,
};

/** Sizes in design units (see ui-root.tsx for the screen scale). Raised after the first play-test: text was too small. */
export const TEXT_SIZES = {
	small: 16,
	body: 20,
	large: 24,
	title: 30,
	huge: 40,
};

export const RADIUS = {
	small: new UDim(0, 8),
	medium: new UDim(0, 14),
	large: new UDim(0, 18),
	xlarge: new UDim(0, 26),
	round: new UDim(1, 0),
};

export const STROKE = {
	thin: 2,
	thick: 3.5,
	heavy: 4,
};

/** How far the dark "3D" block sticks out under buttons, ribbons and panels. */
export const DEPTH = {
	button: 6,
	panel: 8,
};

/** Minimum touch target on phones (Apple / Google guidelines use 44 pt). */
export const MIN_TOUCH = 52;

export type Tone = "normal" | "muted" | "gold" | "success" | "danger" | "crystal" | "dark";

export function toneColor(tone: Tone): Color3 {
	switch (tone) {
		case "muted":
			return COLORS.textMuted;
		case "gold":
			return COLORS.gold;
		case "success":
			return COLORS.success;
		case "danger":
			return COLORS.danger;
		case "crystal":
			return COLORS.crystal;
		case "dark":
			return COLORS.textDark;
		default:
			return COLORS.text;
	}
}

/** A top-to-bottom colour ramp. Every juicy surface (button, ribbon, panel, card) is one of these. */
export interface Ramp {
	readonly top: Color3;
	readonly mid: Color3;
	readonly bottom: Color3;
}

/**
 * The ramp as a UIGradient sequence. Used on a WHITE background: a gradient multiplies colours, so white shows the ramp
 * exactly. `lighten` (0..1) moves every stop toward white, which is how buttons react to hover.
 */
export function rampSequence(ramp: Ramp, lighten = 0): ColorSequence {
	const lift = (color: Color3) => color.Lerp(COLORS.white, lighten);
	return new ColorSequence([
		new ColorSequenceKeypoint(0, lift(ramp.top)),
		new ColorSequenceKeypoint(0.5, lift(ramp.mid)),
		new ColorSequenceKeypoint(1, lift(ramp.bottom)),
	]);
}

export const RAMPS = {
	panel: { top: rgb(74, 46, 29), mid: rgb(56, 33, 20), bottom: rgb(38, 21, 12) },
	ribbon: { top: rgb(252, 211, 77), mid: rgb(251, 191, 36), bottom: rgb(249, 115, 22) },
	close: { top: rgb(251, 113, 133), mid: rgb(239, 68, 68), bottom: rgb(185, 28, 28) },
	/** Stat tiles and quiet buttons: a lighter plank fading to a dark one. */
	plank: { top: rgb(107, 68, 48), mid: rgb(74, 46, 30), bottom: rgb(43, 25, 15) },
	/** HUD capsules (money, bag, goal): darker than planks so the coloured badges pop. */
	capsule: { top: rgb(61, 37, 24), mid: rgb(48, 29, 18), bottom: rgb(36, 20, 12) },
	coin: { top: rgb(253, 224, 71), mid: rgb(251, 191, 36), bottom: rgb(249, 115, 22) },
} satisfies Record<string, Ramp>;

export type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "crystal";

/** Button ramps. Text is always white with a dark outline, like the reference design. */
export const BUTTON_RAMPS: { [K in ButtonVariant]: Ramp } = {
	primary: { top: rgb(252, 211, 77), mid: rgb(245, 158, 11), bottom: rgb(234, 88, 12) },
	secondary: RAMPS.plank,
	success: { top: rgb(52, 211, 153), mid: rgb(34, 197, 94), bottom: rgb(21, 128, 61) },
	danger: RAMPS.close,
	crystal: { top: rgb(56, 189, 248), mid: rgb(59, 130, 246), bottom: rgb(37, 99, 235) },
};

export const DISABLED_RAMP: Ramp = { top: rgb(100, 116, 139), mid: rgb(71, 85, 105), bottom: rgb(51, 65, 85) };
export const DISABLED_TEXT = rgb(203, 213, 225);

/** Spring presets for ripple motions. */
export const SPRINGS = {
	snappy: { tension: 500, friction: 26 },
	bouncy: { tension: 380, friction: 16 },
	smooth: { tension: 170, friction: 26 },
};
