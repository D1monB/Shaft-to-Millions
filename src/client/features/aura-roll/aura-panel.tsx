// The aura roll panel (decision 064): the reel that spins through auras and stops on the result, the two spin buttons,
// the pity counter, the odds and "sell duplicates". The result always comes from the server; the reel is only a show.
import React, { useEffect, useState } from "@rbxts/react";
import { MAX_FREE_SPINS, PITY_SPINS, SPIN_CRYSTAL_PRICE } from "shared/config/aura-roll";
import { ITEMS, ItemId } from "shared/config/items";
import {
	SELL_DUPLICATES_REMOTE,
	SPIN_AURA_REMOTE,
	pityOdds,
	rollOdds,
	secondsToNextSpin,
} from "shared/features/aura-roll";
import { nameKeys } from "shared/features/i18n";
import { formatDuration } from "shared/lib/format";
import { useView } from "client/features/profile";
import { useServerClock } from "client/lib/hooks";
import { t } from "client/lib/i18n";
import { ITEM_CARD_HEIGHT, ITEM_CARD_WIDTH, ItemCard } from "client/lib/item-card";
import { sendToServer } from "client/lib/remotes";
import { playSound } from "client/lib/sounds";
import { Button, Card, CardStrip, Label, StripSlot, TEXT_SIZES } from "client/lib/ui-kit";
import { lastResult, onResult } from "./reel-state";

const ODDS = rollOdds();
/** The guaranteed spin's chances as one line (names in the viewer's language). */
function PITY_TEXT(): string {
	return pityOdds()
		.map((line) => `${t(nameKeys.item(line.item))} ${string.format("%.1f", line.chance * 100)}%`)
		.join(", ");
}
/** The reel switches this often, slowing down toward the end. */
const REEL_STEPS = 18;

/** The big card in the middle: spins through random auras, then shows what the server rolled. */
function Reel() {
	const [shown, setShown] = useState<ItemId | undefined>(lastResult()?.item);
	const [spinning, setSpinning] = useState(false);
	useEffect(
		() =>
			onResult((item) => {
				setSpinning(true);
				task.spawn(() => {
					for (let step = 0; step < REEL_STEPS; step++) {
						setShown(ODDS[math.random(0, ODDS.size() - 1)].item);
						playSound("hit");
						task.wait(0.05 + (step / REEL_STEPS) ** 2 * 0.2);
					}
					setShown(item);
					setSpinning(false);
					const rarity = ITEMS[item].rarity;
					playSound(rarity === "epic" || rarity === "legendary" ? "chestRare" : "chestOpen");
				});
			}),
		[],
	);
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, ITEM_CARD_HEIGHT)} LayoutOrder={1}>
			<frame
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 0)}
				Size={new UDim2(0, ITEM_CARD_WIDTH, 0, ITEM_CARD_HEIGHT)}
				BackgroundTransparency={1}
			>
				{shown !== undefined ? (
					<ItemCard item={shown} highlighted={!spinning} />
				) : (
					<Label text="вњЁ" size={72} align="center" />
				)}
			</frame>
		</frame>
	);
}

export function AuraPanel() {
	const view = useView();
	const now = useServerClock(1);
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	const state = view.auraRoll;
	const wait = secondsToNextSpin(state, now);
	return (
		<>
			<Reel />
			<Button
				text={t("aura.freeSpin", { count: state.spins, max: MAX_FREE_SPINS })}
				variant="primary"
				shine={state.spins > 0}
				disabled={state.spins <= 0}
				height={52}
				textSize={TEXT_SIZES.large}
				onClick={() => sendToServer(SPIN_AURA_REMOTE, "free")}
				order={2}
			/>
			<Button
				text={t("aura.crystalSpin", { price: SPIN_CRYSTAL_PRICE })}
				variant="success"
				disabled={view.crystals < SPIN_CRYSTAL_PRICE}
				height={46}
				onClick={() => sendToServer(SPIN_AURA_REMOTE, "crystals")}
				order={3}
			/>
			<Card order={4} gap={4}>
				{state.spins < MAX_FREE_SPINS && (
					<Label text={t("aura.nextSpin", { time: formatDuration(wait) })} tone="muted" order={1} />
				)}
				<Label text={t("aura.pity", { count: PITY_SPINS - state.pity })} tone="gold" order={2} />
				<Label text={t("aura.odds")} display={true} order={3} />
				<Label text={t("aura.oddsHint")} tone="muted" size={TEXT_SIZES.small} order={4} />
				<Label
					text={t("aura.pityOdds", { odds: PITY_TEXT() })}
					tone="muted"
					size={TEXT_SIZES.small}
					order={5}
				/>
			</Card>
			<CardStrip cardWidth={ITEM_CARD_WIDTH} cardHeight={ITEM_CARD_HEIGHT} order={5}>
				{ODDS.map((line, index) => (
					<StripSlot key={line.item} width={ITEM_CARD_WIDTH} height={ITEM_CARD_HEIGHT} order={index}>
						<ItemCard
							item={line.item}
							topRight={{
								text: `${string.format("%.1f", line.chance * 100)}%`,
								color: Color3.fromRGB(255, 255, 255),
							}}
						/>
					</StripSlot>
				))}
			</CardStrip>
			<Button
				text={t("aura.sellDuplicates")}
				variant="slate"
				height={40}
				onClick={() => sendToServer(SELL_DUPLICATES_REMOTE)}
				order={6}
			/>
		</>
	);
}
