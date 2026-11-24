// How chest items look in the UI: rarity colour, icon and a one-line effect. Shared by chests and equipment.
import { ITEMS, ItemId, ItemKind, RARITY_COLORS } from "shared/config/items";
import { formatPercent } from "shared/lib/format";

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
