// Visual theme of the whole UI: mine timber, gold and red canyon, matching the map concept.
// Components read colours and fonts only from here, so a restyle is a change in one file.

function rgb(r: number, g: number, b: number): Color3 {
	return Color3.fromRGB(r, g, b);
}

export const COLORS = {
	// Timber: panels are dark planks, cards are lighter planks on top of them.
	woodDark: rgb(54, 34, 22),
	wood: rgb(86, 54, 33),
	woodLight: rgb(122, 80, 48),
	outline: rgb(28, 17, 10),

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

export const FONTS = {
	/** Chunky, rounded: titles, numbers, buttons. */
	display: Enum.Font.FredokaOne,
	/** Readable body text. */
	body: Enum.Font.BuilderSansMedium,
	bodyBold: Enum.Font.BuilderSansBold,
};

export const TEXT_SIZES = {
	small: 14,
	body: 17,
	large: 21,
	title: 28,
	huge: 36,
};

export const RADIUS = {
	small: new UDim(0, 8),
	medium: new UDim(0, 12),
	large: new UDim(0, 18),
	round: new UDim(1, 0),
};

export const STROKE = {
	thin: 2,
	thick: 3,
	heavy: 4,
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

/** Button colour pairs: face and the darker "side" that gives the 3D look. */
export type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "crystal";

export const BUTTON_COLORS: { [K in ButtonVariant]: { face: Color3; side: Color3; text: Color3 } } = {
	primary: { face: COLORS.gold, side: COLORS.goldDark, text: COLORS.textDark },
	secondary: { face: COLORS.woodLight, side: COLORS.outline, text: COLORS.text },
	success: { face: COLORS.success, side: COLORS.successDark, text: COLORS.textDark },
	danger: { face: COLORS.canyon, side: COLORS.canyonDark, text: COLORS.text },
	crystal: { face: COLORS.crystal, side: COLORS.crystalDark, text: COLORS.textDark },
};

export const DISABLED_BUTTON = { face: COLORS.stone, side: COLORS.stoneDark, text: COLORS.woodDark };

/** Spring presets for ripple motions. */
export const SPRINGS = {
	snappy: { tension: 500, friction: 26 },
	bouncy: { tension: 380, friction: 16 },
	smooth: { tension: 170, friction: 26 },
};
