// HUD icons (decision 045): every emoji the HUD shows can be swapped for an image by filling its id here
// ("rbxassetid://123"). Empty = keep the emoji. Only licensed images: our own, the map author's, or free Creator Store
// icon packs whose terms allow use in games (note the pack next to the id).
//
// Pack: "Simulator Icon Pack" by DevJoob (Creator Store 99176447965360, free, "for all your simulator needs"); a copy
// sits in ServerStorage.SimulatorIconPack, the ids below are its images. Names in comments are the pack's.
export const ICON_IMAGES: { readonly [emoji: string]: string } = {
	// top-left capsules and the goal
	$: "rbxassetid://15402858705", // CashIcon
	"💎": "rbxassetid://17368064384", // GemIcon
	"🎒": "rbxassetid://15402958715", // Inventory (bag capsule and the Items button)
	"🎯": "rbxassetid://17368118782", // Quests
	// stat tiles
	"⛏️": "",
	"👟": "rbxassetid://17368052918", // Speed
	"🎁": "rbxassetid://15402967660", // Gift
	"✨": "rbxassetid://15403047368", // TripleStars
	"🕳": "rbxassetid://17368164592", // Portal
	"📦": "rbxassetid://17368122337", // Box
	"💰": "rbxassetid://15402870039", // CashBag
	// dock buttons
	"🛒": "rbxassetid://17368217589", // Shop
	"🧭": "rbxassetid://136316479415717", // Teleport
	"🏆": "rbxassetid://12129301834", // Trophies/Wins
	"🌐": "",
	"🛠": "rbxassetid://17368089841", // Settings
	"⋯": "rbxassetid://75590499344429", // More
};

/** The image for this emoji, or undefined to keep the emoji. */
export function iconImage(emoji: string): string | undefined {
	const image = ICON_IMAGES[emoji];
	return image !== undefined && image !== "" ? image : undefined;
}
