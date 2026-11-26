// Chest panel: every possible reward as a rarity card with its chance, shown BEFORE any payment (Roblox policy),
// then a reveal screen for the result. Layout and colours follow the developer's reference design.
import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import { MarketplaceService, Players } from "@rbxts/services";
import { CHESTS, ChestId, isChestId } from "shared/config/chests";
import { INVENTORY_LIMIT, ITEMS, ItemId, isItemId } from "shared/config/items";
import { nameKeys } from "shared/features/i18n";
import { t } from "client/lib/i18n";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import {
	CHEST_RESULT_REMOTE,
	OPEN_CHEST_REMOTE,
	ROBUX_CHESTS_ALLOWED_ATTRIBUTE,
	chestOdds,
} from "shared/features/chests";
import { formatCount, formatPercent } from "shared/lib/format";
import { registerHudStat } from "client/features/hud";
import { useView } from "client/features/profile";
import { ITEM_CARD_HEIGHT, ITEM_CARD_WIDTH, ItemCard } from "client/lib/item-card";
import { KIND_ICONS, RARITY_LIGHT, RARITY_RAMPS, effectText, rarityColor } from "client/lib/item-display";
import { ModelIcon, petTemplate } from "client/lib/model-icon";
import { playTerminalBurst } from "./terminal-fx";
import { closePanel, openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { onServerMessage, sendToServer } from "client/lib/remotes";
import { playSound } from "client/lib/sounds";
import { toast } from "client/lib/toasts";
import {
	BuyButton,
	Button,
	ButtonRow,
	COLORS,
	CardStrip,
	FONTS,
	Label,
	ProgressBar,
	RADIUS,
	STROKE,
	StripSlot,
	Sunburst,
	TEXT_SIZES,
	rampSequence,
	rowItemWidth,
} from "client/lib/ui-kit";

/** Robux is offered only when the server says so (fail closed, same as the server). */
function robuxAllowed(): boolean {
	return Players.LocalPlayer.GetAttribute(ROBUX_CHESTS_ALLOWED_ATTRIBUTE) === true;
}

/** "🎁 Items in storage: 14 / 60" with a small bar, centred like in the reference. */
function StoragePill(props: { count: number; order: number }) {
	const full = props.count >= INVENTORY_LIMIT;
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 30)} LayoutOrder={props.order}>
			<frame
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				Size={new UDim2(0, 0, 0, 30)}
				AutomaticSize={Enum.AutomaticSize.X}
				BackgroundColor3={COLORS.well}
			>
				<uicorner CornerRadius={RADIUS.round} />
				<uistroke Color={full ? COLORS.danger : COLORS.outline} Thickness={STROKE.thin} />
				<uipadding PaddingLeft={new UDim(0, 16)} PaddingRight={new UDim(0, 16)} />
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					Padding={new UDim(0, 12)}
					SortOrder={Enum.SortOrder.LayoutOrder}
					VerticalAlignment={Enum.VerticalAlignment.Center}
				/>
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(0, 0, 1, 0)}
					AutomaticSize={Enum.AutomaticSize.X}
					Font={FONTS.display}
					RichText={true}
					Text={`🎁  ${t("chest.storage")} <font color="#FCD34D">${formatCount(props.count, INVENTORY_LIMIT)}</font>${full ? `  · ${t("chest.full")}` : ""}`}
					TextSize={TEXT_SIZES.small + 1}
					TextColor3={COLORS.text}
					LayoutOrder={1}
				/>
				<frame BackgroundTransparency={1} Size={new UDim2(0, 90, 0, 12)} LayoutOrder={2}>
					<ProgressBar
						progress={props.count / INVENTORY_LIMIT}
						color={full ? COLORS.canyon : COLORS.gold}
						height={12}
					/>
				</frame>
			</frame>
		</frame>
	);
}

/** The odds: every reward as a card with its chance, in one row that scrolls left-right. */
function ChestPanel(props: { chestId: ChestId }) {
	const view = useView();
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	return (
		<>
			<Label
				text={t("chest.whatDrops", { description: t(nameKeys.chestDescription(props.chestId)) })}
				tone="muted"
				size={TEXT_SIZES.small}
				order={1}
			/>
			<CardStrip cardWidth={ITEM_CARD_WIDTH} cardHeight={ITEM_CARD_HEIGHT} order={2}>
				{chestOdds(props.chestId).map((line, index) => (
					<StripSlot key={`odds_${index}`} width={ITEM_CARD_WIDTH} height={ITEM_CARD_HEIGHT} order={index}>
						<ItemCard
							item={line.item}
							topRight={{
								text: formatPercent(line.chance),
								color: RARITY_LIGHT[ITEMS[line.item].rarity],
							}}
						/>
					</StripSlot>
				))}
			</CardStrip>
		</>
	);
}

/** Pinned under the odds, never scrolled away: storage, the open button and the Robux line. */
function ChestFooter(props: { chestId: ChestId }) {
	const view = useView();
	if (view === undefined) {
		return <></>;
	}
	const chest = CHESTS[props.chestId];
	const full = view.inventory.size() >= INVENTORY_LIMIT;
	const productId = chest.robuxProductId;

	let robux: React.Element;
	if (productId === undefined) {
		robux = <Label text={t("chest.robuxSoon")} tone="muted" size={TEXT_SIZES.small} align="center" order={6} />;
	} else if (!robuxAllowed()) {
		robux = <Label text={t("chest.robuxBlocked")} tone="muted" size={TEXT_SIZES.small} align="center" order={6} />;
	} else {
		robux = (
			<>
				<Button
					text={t("chest.openRobux", { price: chest.robuxPrice })}
					variant="crystal"
					onClick={() => MarketplaceService.PromptProductPurchase(Players.LocalPlayer, productId)}
					disabled={full}
					order={6}
				/>
				<Label text={t("chest.noRobux")} tone="muted" size={TEXT_SIZES.small} align="center" order={7} />
			</>
		);
	}

	return (
		<>
			<StoragePill count={view.inventory.size()} order={4} />
			<BuyButton
				price={chest.crystalPrice}
				money={view.crystals}
				currency="crystals"
				verb={t("common.open")}
				icon="✨"
				blocked={full}
				height={52}
				textSize={TEXT_SIZES.large}
				onClick={() => sendToServer(OPEN_CHEST_REMOTE, props.chestId)}
				order={5}
			/>
			{robux}
		</>
	);
}

/** The terminal colour of each chest on the friend's map: pets pink, pickaxe aura violet, speed aura teal. */
const CHEST_ACCENTS = { pet_chest: "pets", pickaxe_chest: "pickaxeAura", speed_chest: "speedAura" } as const;

function openChest(chestId: ChestId): void {
	openPanel({
		key: `chest_${chestId}`,
		title: t(nameKeys.chest(chestId)),
		icon: "🎁",
		accent: CHEST_ACCENTS[chestId],
		render: () => <ChestPanel chestId={chestId} />,
		footer: () => <ChestFooter chestId={chestId} />,
	});
}

/**
 * The reveal: the item tile bounces in over turning light rays on the left, its name and effect on the right.
 * Side by side so it fits a landscape phone without scrolling (developer's feedback 2026-11-25); the buttons are in
 * the pinned footer.
 */
function ChestResult(props: { item: ItemId }) {
	const def = ITEMS[props.item];
	const color = rarityColor(props.item);
	const petModel = def.kind === "pet" ? petTemplate(props.item) : undefined;
	const [scale, scaleMotion] = useMotion(0.3);
	useEffect(() => {
		scaleMotion.spring(1, { tension: 260, friction: 12 });
	}, [scaleMotion]);

	return (
		<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 190)} LayoutOrder={1}>
			<canvasgroup BackgroundTransparency={1} Size={new UDim2(0, 190, 0, 190)}>
				<Sunburst zIndex={1} />
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(0, 120, 0, 120)}
					BackgroundColor3={COLORS.white}
					ZIndex={2}
				>
					<uiscale Scale={scale} />
					<uicorner CornerRadius={RADIUS.xlarge} />
					<uistroke Color={COLORS.outline} Thickness={STROKE.heavy} />
					<uigradient Rotation={90} Color={rampSequence(RARITY_RAMPS[def.rarity])} />
					{petModel !== undefined ? (
						<ModelIcon
							template={petModel}
							size={new UDim2(1, -10, 1, -10)}
							position={UDim2.fromOffset(5, 5)}
							zIndex={3}
						/>
					) : (
						<textlabel
							BackgroundTransparency={1}
							Size={new UDim2(1, 0, 1, 0)}
							Text={KIND_ICONS[def.kind]}
							TextSize={68}
							ZIndex={3}
						/>
					)}
				</frame>
			</canvasgroup>
			<frame BackgroundTransparency={1} Position={new UDim2(0, 206, 0, 0)} Size={new UDim2(1, -206, 1, 0)}>
				<uilistlayout
					Padding={new UDim(0, 6)}
					SortOrder={Enum.SortOrder.LayoutOrder}
					VerticalAlignment={Enum.VerticalAlignment.Center}
				/>
				<Label
					text={t(nameKeys.item(props.item))}
					display={true}
					size={TEXT_SIZES.huge - 6}
					color={color}
					order={1}
				/>
				<Label
					text={`${t(nameKeys.rarity(def.rarity))} · ${t(nameKeys.kind(def.kind))}`}
					tone="muted"
					order={2}
				/>
				<Label
					text={effectText(def.kind, def.bonus)}
					display={true}
					size={TEXT_SIZES.large}
					tone="gold"
					order={3}
				/>
				<Label text={t("chest.alreadyOwned")} tone="muted" size={TEXT_SIZES.small} order={4} />
			</frame>
		</frame>
	);
}

/** Pinned under the reveal: take it, or open the same chest again. */
function ChestResultFooter(props: { chestId: ChestId }) {
	return (
		<ButtonRow count={2} order={1}>
			<Button text={t("chest.take")} onClick={closePanel} width={rowItemWidth(2)} order={1} />
			<Button
				text={t("chest.again")}
				variant="secondary"
				onClick={() => openChest(props.chestId)}
				width={rowItemWidth(2)}
				order={2}
			/>
		</ButtonRow>
	);
}

export function startChestsController(): void {
	onPromptForTag(TAGS.Chest, (instance) => {
		const chestId = instance.GetAttribute(ATTRIBUTES.ChestId);
		if (isChestId(chestId)) {
			openChest(chestId);
		}
	});
	onServerMessage(CHEST_RESULT_REMOTE, (item, chestId) => {
		if (isItemId(item) && isChestId(chestId)) {
			playSound("chestOpen");
			playTerminalBurst(chestId);
			const rarity = ITEMS[item].rarity;
			if (rarity === "rare" || rarity === "epic" || rarity === "legendary") {
				playSound("chestRare");
			}
			// "info", not "success": the chest has its own sound, a third one on top would be noise.
			toast(t("chest.dropped", { item: t(nameKeys.item(item)) }), "info", 4);
			openPanel({
				key: `chest_result_${item}_${os.clock()}`,
				title: t("chest.newItem"),
				icon: "🎉",
				accent: CHEST_ACCENTS[chestId],
				render: () => <ChestResult item={item} />,
				footer: () => <ChestResultFooter chestId={chestId} />,
			});
		}
	});
	registerHudStat(50, (view) =>
		view.inventory.size() > 0
			? {
					icon: "🎁",
					text: t("hud.storage", { count: formatCount(view.inventory.size(), INVENTORY_LIMIT) }),
					short: formatCount(view.inventory.size(), INVENTORY_LIMIT),
				}
			: undefined,
	);
}
