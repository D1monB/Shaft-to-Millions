// Chest panel: every possible reward as a rarity card with its chance, shown BEFORE any payment (Roblox policy),
// then a reveal screen for the result. Layout and colours follow the developer's reference design.
import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import { MarketplaceService, Players } from "@rbxts/services";
import { CHESTS, ChestId, isChestId } from "shared/config/chests";
import { INVENTORY_LIMIT, ITEMS, ItemId, KIND_NAMES, RARITY_NAMES, isItemId } from "shared/config/items";
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
import { ITEM_CARD_HEIGHT, ItemCard } from "client/lib/item-card";
import { KIND_ICONS, RARITY_LIGHT, RARITY_RAMPS, effectText, rarityColor } from "client/lib/item-display";
import { closePanel, openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { onServerMessage, sendToServer } from "client/lib/remotes";
import { toast } from "client/lib/toasts";
import {
	BuyButton,
	Button,
	COLORS,
	Card,
	FONTS,
	Label,
	ProgressBar,
	RADIUS,
	STROKE,
	Sunburst,
	TEXT_SIZES,
	rampSequence,
} from "client/lib/ui-kit";

/** Robux is offered only when the server says so (fail closed, same as the server). */
function robuxAllowed(): boolean {
	return Players.LocalPlayer.GetAttribute(ROBUX_CHESTS_ALLOWED_ATTRIBUTE) === true;
}

/** "🎁 Предметів у сховищі: 14 / 60" with a small bar, centred like in the reference. */
function StoragePill(props: { count: number; order: number }) {
	const full = props.count >= INVENTORY_LIMIT;
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 40)} LayoutOrder={props.order}>
			<frame
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				Size={new UDim2(0, 0, 0, 40)}
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
					Text={`🎁  Предметів у сховищі: <font color="#FCD34D">${formatCount(props.count, INVENTORY_LIMIT)}</font>${full ? "  · повне" : ""}`}
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

function ChestPanel(props: { chestId: ChestId }) {
	const view = useView();
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	const chest = CHESTS[props.chestId];
	const full = view.inventory.size() >= INVENTORY_LIMIT;
	const productId = chest.robuxProductId;

	let robux: React.Element;
	if (productId === undefined) {
		robux = (
			<Label
				text="💎 Гра повністю проходиться без Robux · Відкриття за Robux у розробці"
				tone="muted"
				size={TEXT_SIZES.small}
				align="center"
				order={6}
			/>
		);
	} else if (!robuxAllowed()) {
		robux = (
			<Label
				text="💎 Гра повністю проходиться без Robux · Відкриття за Robux недоступне для твого акаунта"
				tone="muted"
				size={TEXT_SIZES.small}
				align="center"
				order={6}
			/>
		);
	} else {
		robux = (
			<>
				<Button
					text={`💎  Відкрити за R$ ${chest.robuxPrice}`}
					variant="crystal"
					onClick={() => MarketplaceService.PromptProductPurchase(Players.LocalPlayer, productId)}
					disabled={full}
					order={6}
				/>
				<Label
					text="💎 Гра повністю проходиться без Robux"
					tone="muted"
					size={TEXT_SIZES.small}
					align="center"
					order={7}
				/>
			</>
		);
	}

	return (
		<>
			<Label text="✨ Що може випасти (шанси):" display={true} size={TEXT_SIZES.large} order={1} />
			<Label text={chest.description} tone="muted" size={TEXT_SIZES.small + 1} order={2} />
			<Card order={3}>
				<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 0)} AutomaticSize={Enum.AutomaticSize.Y}>
					<uigridlayout
						CellSize={new UDim2(1 / 3, -8, 0, ITEM_CARD_HEIGHT)}
						CellPadding={new UDim2(0, 12, 0, 14)}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{chestOdds(props.chestId).map((line, index) => (
						<ItemCard
							key={`odds_${index}`}
							item={line.item}
							topRight={{
								text: formatPercent(line.chance),
								color: RARITY_LIGHT[ITEMS[line.item].rarity],
							}}
							order={index}
						/>
					))}
				</frame>
			</Card>
			<StoragePill count={view.inventory.size()} order={4} />
			<BuyButton
				price={chest.dollarPrice}
				money={view.money}
				verb="Відкрити"
				icon="✨"
				blocked={full}
				height={66}
				textSize={TEXT_SIZES.title - 2}
				onClick={() => sendToServer(OPEN_CHEST_REMOTE, props.chestId)}
				order={5}
			/>
			{robux}
		</>
	);
}

function openChest(chestId: ChestId): void {
	openPanel({
		key: `chest_${chestId}`,
		title: CHESTS[chestId].name,
		icon: "🎁",
		render: () => <ChestPanel chestId={chestId} />,
	});
}

/** The reveal: the item tile bounces in over turning light rays, like the reference reward popup. */
function ChestResult(props: { item: ItemId; chestId: ChestId }) {
	const def = ITEMS[props.item];
	const color = rarityColor(props.item);
	const [scale, scaleMotion] = useMotion(0.3);
	useEffect(() => {
		scaleMotion.spring(1, { tension: 260, friction: 12 });
	}, [scaleMotion]);

	return (
		<>
			<canvasgroup BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 230)} LayoutOrder={1}>
				<Sunburst zIndex={1} />
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(0, 150, 0, 150)}
					BackgroundColor3={COLORS.white}
					ZIndex={2}
				>
					<uiscale Scale={scale} />
					<uicorner CornerRadius={RADIUS.xlarge} />
					<uistroke Color={COLORS.outline} Thickness={STROKE.heavy} />
					<uigradient Rotation={90} Color={rampSequence(RARITY_RAMPS[def.rarity])} />
					<textlabel
						BackgroundTransparency={1}
						Size={new UDim2(1, 0, 1, 0)}
						Text={KIND_ICONS[def.kind]}
						TextSize={84}
						ZIndex={3}
					/>
				</frame>
			</canvasgroup>
			<Label
				text={`${def.name} · ${RARITY_NAMES[def.rarity]}`}
				display={true}
				size={TEXT_SIZES.huge - 6}
				color={color}
				align="center"
				order={2}
			/>
			<Label text={KIND_NAMES[def.kind]} tone="muted" align="center" order={3} />
			<Label
				text={effectText(def.kind, def.bonus)}
				display={true}
				size={TEXT_SIZES.large}
				tone="gold"
				align="center"
				order={4}
			/>
			<Label
				text="Предмет уже в інвентарі. Надінь його в меню «Речі»."
				tone="muted"
				size={TEXT_SIZES.small + 1}
				align="center"
				order={5}
			/>
			<Button text="Забрати!" onClick={closePanel} height={60} textSize={TEXT_SIZES.large} order={6} />
			<Button text="Ще раз" variant="secondary" onClick={() => openChest(props.chestId)} order={7} />
		</>
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
			toast(`Випало: ${ITEMS[item].name}!`, "success", 4);
			openPanel({
				key: `chest_result_${item}_${os.clock()}`,
				title: "Новий предмет!",
				icon: "🎉",
				render: () => <ChestResult item={item} chestId={chestId} />,
			});
		}
	});
	registerHudStat(50, (view) =>
		view.inventory.size() > 0
			? {
					icon: "🎁",
					text: `Предметів у сховищі: ${formatCount(view.inventory.size(), INVENTORY_LIMIT)}`,
					short: formatCount(view.inventory.size(), INVENTORY_LIMIT),
				}
			: undefined,
	);
}
