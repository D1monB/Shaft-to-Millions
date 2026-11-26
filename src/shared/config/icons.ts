// HUD icons (decision 045): every emoji the HUD shows can be swapped for an image by filling its id here
// ("rbxassetid://123"). Empty = keep the emoji. Only licensed images: our own, the map author's, or free Creator Store
// icon packs whose terms allow use in games (note the pack next to the id).
export const ICON_IMAGES: { readonly [emoji: string]: string } = {
	// top-left capsules and the goal
	$: "",
	"💎": "",
	"🎒": "",
	"🎯": "",
	// stat tiles
	"⛏️": "",
	"👟": "",
	"🎁": "",
	"✨": "",
	"🕳": "",
	"📦": "",
	"💰": "",
	// dock buttons
	"🛒": "",
	"🧭": "",
	"🏆": "",
	"🌐": "",
	"🛠": "",
};

/** The image for this emoji, or undefined to keep the emoji. */
export function iconImage(emoji: string): string | undefined {
	const image = ICON_IMAGES[emoji];
	return image !== undefined && image !== "" ? image : undefined;
}
