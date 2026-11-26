// Visual theme of the whole UI: "dark glass + neon" (developer's choice 2026-11-25, decision 029). Translucent graphite
// panels with a thin glowing outline in the colour of the section, orange main buttons, gold money. It matches the
// friend's map: light concrete, orange canyon rocks and neon terminals (pink pets, violet pickaxe aura, teal aura).
// Components read colours and fonts only from here, so a restyle is a change in one file.
// The old timber key names (wood*, well) are kept so features need no edits; they now hold graphite shades.

function rgb(r: number, g: number, b: number): Color3 {
	return Color3.fromRGB(r, g, b);
}

export const COLORS = {
	// Graphite glass: panels are dark slate; cards inside them are darker wells.
	woodDark: rgb(24, 27, 36),
	wood: rgb(38, 42, 54),
	woodLight: rgb(58, 64, 80),
	/** Inset wells inside panels (lists, card grids). */
	well: rgb(16, 18, 25),
	/** Every outline and every small "3D" shadow block uses this one colour. */
	outline: rgb(10, 12, 18),

	gold: rgb(255, 200, 70),
	goldDark: rgb(196, 132, 24),
	canyon: rgb(255, 128, 48),
	canyonDark: rgb(196, 78, 22),
	crystal: rgb(80, 220, 235),
	crystalDark: rgb(24, 140, 170),
	success: rgb(96, 222, 120),
	successDark: rgb(36, 150, 70),
	stone: rgb(150, 156, 172),
	stoneDark: rgb(90, 96, 112),

	text: rgb(244, 246, 252),
	textMuted: rgb(164, 172, 192),
	textDark: rgb(20, 22, 30),
	danger: rgb(255, 96, 96),
	white: rgb(255, 255, 255),
	black: rgb(0, 0, 0),
};

/** Neon accent per section, taken from the friend's terminals. Panels glow in their section's colour. */
export const ACCENTS = {
	/** Default: shops, factory, everything without its own colour. */
	orange: rgb(255, 140, 40),
	pets: rgb(255, 92, 190),
	pickaxeAura: rgb(176, 104, 255),
	speedAura: rgb(40, 226, 210),
	money: rgb(255, 200, 70),
	travel: rgb(96, 170, 255),
};

export type Accent = keyof typeof ACCENTS;

/** How see-through panels are: the game shows faintly behind them, text stays readable. */
export const GLASS_TRANSPARENCY = 0.1;

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
	small: 14,
	body: 17,
	large: 21,
	title: 25,
	huge: 34,
};

export const RADIUS = {
	small: new UDim(0, 6),
	medium: new UDim(0, 10),
	large: new UDim(0, 14),
	xlarge: new UDim(0, 18),
	round: new UDim(1, 0),
};

export const STROKE = {
	thin: 1.5,
	thick: 2,
	heavy: 2.5,
};

/** How far the dark "3D" block sticks out under buttons, ribbons and panels. */
export const DEPTH = {
	button: 3,
	panel: 4,
};

/** Minimum touch target on phones (Apple / Google guidelines use 44 pt). */
export const MIN_TOUCH = 44;

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
	panel: { top: rgb(40, 44, 58), mid: rgb(28, 31, 42), bottom: rgb(20, 22, 30) },
	ribbon: { top: rgb(255, 176, 72), mid: rgb(255, 140, 40), bottom: rgb(234, 98, 20) },
	close: { top: rgb(255, 120, 120), mid: rgb(236, 72, 72), bottom: rgb(180, 36, 48) },
	/** Stat tiles and quiet buttons: a lighter slate fading to a dark one. */
	plank: { top: rgb(62, 68, 86), mid: rgb(42, 46, 60), bottom: rgb(28, 31, 42) },
	/** HUD capsules (money, bag, goal): darker than tiles so the coloured badges pop. */
	capsule: { top: rgb(38, 42, 56), mid: rgb(28, 31, 42), bottom: rgb(20, 22, 30) },
	coin: { top: rgb(253, 224, 71), mid: rgb(251, 191, 36), bottom: rgb(249, 115, 22) },
	/** Crystals, the second currency (decision 043). */
	gem: { top: rgb(165, 243, 252), mid: rgb(80, 220, 235), bottom: rgb(24, 140, 170) },
} satisfies Record<string, Ramp>;

export type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "crystal" | "slate";

/** Button ramps. Text is always white with a dark outline, like the reference design. */
export const BUTTON_RAMPS: { [K in ButtonVariant]: Ramp } = {
	primary: { top: rgb(255, 176, 72), mid: rgb(255, 140, 40), bottom: rgb(226, 92, 18) },
	secondary: RAMPS.plank,
	success: { top: rgb(52, 211, 153), mid: rgb(34, 197, 94), bottom: rgb(21, 128, 61) },
	danger: RAMPS.close,
	crystal: { top: rgb(56, 189, 248), mid: rgb(59, 130, 246), bottom: rgb(37, 99, 235) },
	/** Quiet tools (Dev). */
	slate: { top: rgb(100, 116, 139), mid: rgb(71, 85, 105), bottom: rgb(51, 65, 85) },
};

export const DISABLED_RAMP: Ramp = { top: rgb(100, 116, 139), mid: rgb(71, 85, 105), bottom: rgb(51, 65, 85) };
export const DISABLED_TEXT = rgb(203, 213, 225);

/** Spring presets for ripple motions. */
export const SPRINGS = {
	snappy: { tension: 500, friction: 26 },
	bouncy: { tension: 380, friction: 16 },
	smooth: { tension: 170, friction: 26 },
};
