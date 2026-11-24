// Shop panel: current gear, the next level, what it gives, and its price. Buying sends only the intent
// (track + the level the player saw); the server checks money and distance.
import { BAGS } from "shared/config/bags";
import { TAGS } from "shared/config/map-contract";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import {
	BUY_UPGRADE_REMOTE,
	UPGRADE_TRACKS,
	UPGRADE_TRACK_IDS,
	UpgradeTrack,
	nextLevelDef,
} from "shared/features/upgrades";
import { formatMoney } from "shared/lib/format";
import { getView } from "client/features/profile";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import { THEME, makeButton, makeCard, makeLabel, openPanel } from "client/lib/ui";

const TRACK_TITLES: { [K in UpgradeTrack]: string } = {
	pickaxe: "⛏ Кирка",
	bag: "🎒 Сумка",
};

const extraDescribers = new Map<string, (level: number) => string>();

/** Lets later tracks (e.g. shoes) describe their levels in the shop. */
export function registerTrackDescriber(track: string, describe: (level: number) => string): void {
	extraDescribers.set(track, describe);
}

function describe(track: UpgradeTrack, level: number): string {
	if (track === "pickaxe") {
		const pickaxe = PICKAXES[level - 1];
		return `Рівень руди ${pickaxe.tier}, сила удару ${pickaxe.power}`;
	}
	if (track === "bag") {
		return `Місткість ${BAGS[level - 1].capacity} шт.`;
	}
	return extraDescribers.get(track)?.(level) ?? "";
}

/** Ores the NEXT pickaxe unlocks: the clearest reason to buy it. */
function newlyUnlocked(level: number): string {
	const current = PICKAXES[level - 1];
	const upcoming = PICKAXES[level];
	if (upcoming === undefined) {
		return "";
	}
	const names = ORE_IDS.filter(
		(id) => ORES[id].requiredTier > current.tier && ORES[id].requiredTier <= upcoming.tier,
	).map((id) => ORES[id].name);
	return names.size() > 0 ? `Відкриває: ${names.join(", ")}` : "";
}

function render(content: ScrollingFrame): void {
	const view = getView();
	if (view === undefined) {
		makeLabel(content, "Завантаження...");
		return;
	}
	makeLabel(content, `У тебе ${formatMoney(view.money)}`, { bold: true, color: THEME.accent, size: 18 });

	for (const track of UPGRADE_TRACK_IDS) {
		const level = view.levels[track];
		const card = makeCard(content);
		makeLabel(card, TRACK_TITLES[track], { bold: true, size: 18 });
		makeLabel(card, `Зараз: ${UPGRADE_TRACKS[track][level - 1].name}. ${describe(track, level)}`, {
			color: THEME.muted,
		});
		const upcoming = nextLevelDef(track, level);
		if (upcoming === undefined) {
			makeLabel(card, "Максимальний рівень!", { color: THEME.success });
			continue;
		}
		makeLabel(card, `Далі: ${upcoming.name}. ${describe(track, level + 1)}`);
		if (track === "pickaxe") {
			const unlocks = newlyUnlocked(level);
			if (unlocks !== "") {
				makeLabel(card, unlocks, { color: THEME.success });
			}
		}
		const affordable = view.money >= upcoming.price;
		makeButton(
			card,
			affordable
				? `Купити за ${formatMoney(upcoming.price)}`
				: `${formatMoney(upcoming.price)} (бракує ${formatMoney(upcoming.price - view.money)})`,
			() => sendToServer(BUY_UPGRADE_REMOTE, track, level),
			affordable,
		);
	}
}

export function startShopController(): void {
	onPromptForTag(TAGS.Shop, () => openPanel("shop", "Магазин спорядження", render));
}
