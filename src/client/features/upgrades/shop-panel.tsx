// Shop panel: current gear, the next level, what it gives, and its price. Buying sends only the intent
// (track + the level the player saw); the server checks money and distance.
import React from "@rbxts/react";
import { BAGS } from "shared/config/bags";
import { TAGS } from "shared/config/map-contract";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import {
	BUY_UPGRADE_REMOTE,
	UPGRADE_TRACKS,
	UPGRADE_TRACK_IDS,
	UpgradeTrack,
	nextLevelDef,
} from "shared/features/upgrades";
import { useView } from "client/features/profile";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { sendToServer } from "client/lib/remotes";
import { BuyButton, COLORS, Card, Label, ProgressBar, TEXT_SIZES } from "client/lib/ui-kit";

const TRACK_TITLES: { [K in UpgradeTrack]: string } = {
	pickaxe: "⛏ Кирка",
	bag: "🎒 Сумка",
	shoes: "👟 Взуття",
};

function describe(track: UpgradeTrack, level: number): string {
	if (track === "pickaxe") {
		const pickaxe = PICKAXES[level - 1];
		return `Рівень руди ${pickaxe.tier}, сила удару ${pickaxe.power}`;
	}
	if (track === "bag") {
		return `Місткість ${BAGS[level - 1].capacity} шт.`;
	}
	return `Швидкість ${SHOES[level - 1].walkSpeed} (стандарт 16)`;
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
	return names.size() > 0 ? `🔓 Відкриває: ${names.join(", ")}` : "";
}

function TrackCard(props: { track: UpgradeTrack; level: number; money: number; order: number }) {
	const { track, level } = props;
	const levels = UPGRADE_TRACKS[track];
	const upcoming = nextLevelDef(track, level);
	const unlocks = track === "pickaxe" ? newlyUnlocked(level) : "";
	return (
		<Card order={props.order} accent={upcoming === undefined ? COLORS.success : undefined}>
			<Label text={TRACK_TITLES[track]} display={true} size={TEXT_SIZES.large} order={1} />
			<ProgressBar
				progress={level / levels.size()}
				color={COLORS.gold}
				text={`Рівень ${level}/${levels.size()}`}
				height={18}
				order={2}
			/>
			<Label text={`Зараз: ${levels[level - 1].name}. ${describe(track, level)}`} tone="muted" order={3} />
			{upcoming === undefined ? (
				<Label text="✨ Максимальний рівень!" tone="success" display={true} order={4} />
			) : (
				<>
					<Label text={`Далі: ${upcoming.name}. ${describe(track, level + 1)}`} order={4} />
					{unlocks !== "" && <Label text={unlocks} tone="success" order={5} />}
					<BuyButton
						price={upcoming.price}
						money={props.money}
						verb="Купити"
						onClick={() => sendToServer(BUY_UPGRADE_REMOTE, track, level)}
						order={6}
					/>
				</>
			)}
		</Card>
	);
}

function ShopPanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	return (
		<>
			{UPGRADE_TRACK_IDS.map((track, index) => (
				<TrackCard key={track} track={track} level={view.levels[track]} money={view.money} order={index} />
			))}
		</>
	);
}

export function startShopController(): void {
	onPromptForTag(TAGS.Shop, () =>
		openPanel({ key: "shop", title: "Магазин спорядження", icon: "🛒", render: () => <ShopPanel /> }),
	);
}
