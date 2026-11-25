// How chest items look in the UI: rarity colour, icon and a one-line effect. Shared by chests and equipment.
import { ITEMS, ItemId, ItemKind, RARITY_COLORS, Rarity } from "shared/config/items";
import { formatPercent } from "shared/lib/format";
import { Ramp } from "./ui-kit";

function rgb(r: number, g: number, b: number): Color3 {
	return Color3.fromRGB(r, g, b);
}

/** Card colours per rarity, from the reference design: grey, green, blue, purple, gold. */
export const RARITY_RAMPS: { readonly [K in Rarity]: Ramp } = {
	common: { top: rgb(203, 213, 225), mid: rgb(148, 163, 184), bottom: rgb(71, 85, 105) },
	uncommon: { top: rgb(110, 231, 183), mid: rgb(16, 185, 129), bottom: rgb(21, 128, 61) },
	rare: { top: rgb(125, 211, 252), mid: rgb(59, 130, 246), bottom: rgb(67, 56, 202) },
	epic: { top: rgb(232, 121, 249), mid: rgb(147, 51, 234), bottom: rgb(76, 29, 149) },
	legendary: { top: rgb(253, 224, 71), mid: rgb(245, 158, 11), bottom: rgb(194, 65, 12) },
};

/** A light tint of each rarity for text on dark pills (chance, rarity name). */
export const RARITY_LIGHT: { readonly [K in Rarity]: Color3 } = {
	common: rgb(226, 232, 240),
	uncommon: rgb(110, 231, 183),
	rare: rgb(125, 211, 252),
	epic: rgb(240, 171, 252),
	legendary: rgb(253, 224, 71),
};

export function rarityColor(item: ItemId): Color3 {
	const [r, g, b] = RARITY_COLORS[ITEMS[item].rarity];
	return Color3.fromRGB(r, g, b);
}

export const KIND_ICONS: { [K in ItemKind]: string } = {
	pet: "🐾",
	speedAura: "💨",
	pickaxeAura: "✨",
};

export function effectText(kind: ItemKind, bonus: number): string {
	if (kind === "pet") {
		return `+${formatPercent(bonus)} до ціни продажу`;
	}
	if (kind === "speedAura") {
		return `+${formatPercent(bonus)} до швидкості`;
	}
	return `+${formatPercent(bonus)} шанс додаткової руди`;
}
