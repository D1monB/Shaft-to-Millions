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

const CARD_HEIGHT = 200;
/** Height of the dark block under each card. */
const CARD_DEPTH = 5;

/** What is written on a rarity card. Kept apart from the surface so a legendary card can wrap it in a CanvasGroup. */
function CardContent(props: { item: ItemId; chance: number }) {
	const def = ITEMS[props.item];
	const light = RARITY_LIGHT[def.rarity];
	return (
		<>
			<textlabel
				AnchorPoint={new Vector2(1, 0)}
				Position={new UDim2(1, -8, 0, 8)}
				Size={new UDim2(0, 60, 0, 26)}
				BackgroundColor3={COLORS.outline}
				BackgroundTransparency={0.15}
				Font={FONTS.display}
				Text={formatPercent(props.chance)}
				TextSize={17}
				TextColor3={light}
				ZIndex={4}
			>
				<uicorner CornerRadius={RADIUS.small} />
			</textlabel>
			<textlabel
				AnchorPoint={new Vector2(0.5, 0)}
				BackgroundTransparency={1}
				Position={new UDim2(0.5, 0, 0, 30)}
				Size={new UDim2(0, 80, 0, 58)}
				Text={KIND_ICONS[def.kind]}
				TextSize={48}
				ZIndex={3}
			/>
			<textlabel
				BackgroundTransparency={1}
				Position={new UDim2(0, 6, 0, 92)}
				Size={new UDim2(1, -12, 0, 26)}
				Font={FONTS.display}
				Text={def.name}
				TextColor3={COLORS.white}
				TextScaled={true}
				ZIndex={3}
			>
				<uitextsizeconstraint MaxTextSize={21} MinTextSize={12} />
				<uistroke Color={COLORS.outline} Thickness={2} />
			</textlabel>
			<frame
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 120)}
				Size={new UDim2(0, 0, 0, 22)}
				AutomaticSize={Enum.AutomaticSize.X}
				BackgroundColor3={COLORS.outline}
				BackgroundTransparency={0.25}
				ZIndex={3}
			>
				<uicorner CornerRadius={RADIUS.round} />
				<uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} />
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(0, 0, 1, 0)}
					AutomaticSize={Enum.AutomaticSize.X}
					Font={FONTS.display}
					Text={RARITY_NAMES[def.rarity].upper()}
					TextSize={13}
					TextColor3={light}
					ZIndex={4}
				/>
			</frame>
			<frame
				BackgroundColor3={COLORS.black}
				BackgroundTransparency={0.8}
				BorderSizePixel={0}
				Position={new UDim2(0, 10, 0, 150)}
				Size={new UDim2(1, -20, 0, 2)}
				ZIndex={3}
			/>
			<textlabel
				BackgroundTransparency={1}
				Position={new UDim2(0, 6, 0, 154)}
				Size={new UDim2(1, -12, 0, 38)}
				Font={FONTS.display}
				Text={effectText(def.kind, def.bonus)}
				TextColor3={COLORS.white}
				TextScaled={true}
				TextWrapped={true}
				ZIndex={3}
			>
				<uitextsizeconstraint MaxTextSize={15} MinTextSize={10} />
				<uistroke Color={COLORS.outline} Thickness={1.5} />
			</textlabel>
		</>
	);
}

/**
 * One possible reward: a card coloured by rarity with the chance in the corner.
 * The legendary card turns light rays behind its content; rays need a CanvasGroup to be clipped to the card.
 */
function RarityCard(props: { item: ItemId; chance: number; order: number }) {
	const rarity = ITEMS[props.item].rarity;
	const ramp = RARITY_RAMPS[rarity];
	const legendary = rarity === "legendary";
	const faceSize = new UDim2(1, 0, 1, -CARD_DEPTH);
	return (
		<frame BackgroundTransparency={1} LayoutOrder={props.order}>
			<frame
				BackgroundColor3={COLORS.outline}
				BorderSizePixel={0}
				Position={new UDim2(0, 0, 0, CARD_DEPTH)}
				Size={faceSize}
			>
				<uicorner CornerRadius={RADIUS.large} />
			</frame>
			{legendary ? (
				<canvasgroup BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={faceSize}>
					<uicorner CornerRadius={RADIUS.large} />
					<uigradient Rotation={90} Color={rampSequence(ramp)} />
					<Sunburst zIndex={1} />
					<CardContent item={props.item} chance={props.chance} />
				</canvasgroup>
			) : (
				<frame BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={faceSize}>
					<uicorner CornerRadius={RADIUS.large} />
					<uigradient Rotation={90} Color={rampSequence(ramp)} />
					<CardContent item={props.item} chance={props.chance} />
				</frame>
			)}
			{/* The outline sits on its own layer: a CanvasGroup would cut a stroke drawn on itself. */}
			<frame BackgroundTransparency={1} Size={faceSize} ZIndex={5}>
				<uicorner CornerRadius={RADIUS.large} />
				<uistroke Color={COLORS.outline} Thickness={STROKE.thick} />
			</frame>
		</frame>
	);
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
						CellSize={new UDim2(1 / 3, -8, 0, CARD_HEIGHT)}
						CellPadding={new UDim2(0, 12, 0, 14)}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{chestOdds(props.chestId).map((line, index) => (
						<RarityCard key={`odds_${index}`} item={line.item} chance={line.chance} order={index} />
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
