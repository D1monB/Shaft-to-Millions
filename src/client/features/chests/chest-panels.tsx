// Chest panel: the full odds table BEFORE any payment (Roblox policy), then a reveal screen for the result.
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
import { KIND_ICONS, effectText, rarityColor } from "client/lib/item-display";
import { openPanel } from "client/lib/panels";
import { onPromptForTag } from "client/lib/prompts";
import { onServerMessage, sendToServer } from "client/lib/remotes";
import { toast } from "client/lib/toasts";
import { BuyButton, Button, COLORS, Card, FONTS, Label, RADIUS, STROKE, TEXT_SIZES } from "client/lib/ui-kit";

/** Robux is offered only when the server says so (fail closed, same as the server). */
function robuxAllowed(): boolean {
	return Players.LocalPlayer.GetAttribute(ROBUX_CHESTS_ALLOWED_ATTRIBUTE) === true;
}

function OddsRow(props: { item: ItemId; chance: number; order: number }) {
	const def = ITEMS[props.item];
	const color = rarityColor(props.item);
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(1, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			LayoutOrder={props.order}
		>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				Padding={new UDim(0, 8)}
				SortOrder={Enum.SortOrder.LayoutOrder}
				VerticalAlignment={Enum.VerticalAlignment.Center}
			/>
			<textlabel
				BackgroundColor3={color}
				Size={new UDim2(0, 64, 0, 26)}
				Font={FONTS.display}
				Text={formatPercent(props.chance)}
				TextSize={TEXT_SIZES.small + 1}
				TextColor3={COLORS.textDark}
				LayoutOrder={1}
			>
				<uicorner CornerRadius={RADIUS.small} />
				<uistroke
					Color={COLORS.outline}
					Thickness={STROKE.thin}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
			</textlabel>
			<Label
				text={`${KIND_ICONS[def.kind]} ${def.name} · ${RARITY_NAMES[def.rarity]}\n${effectText(def.kind, def.bonus)}`}
				color={color}
				size={TEXT_SIZES.small + 1}
				width={new UDim(1, -72)}
				order={2}
			/>
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
		robux = <Label text="Відкриття за Robux ще не налаштоване." tone="muted" size={TEXT_SIZES.small} order={5} />;
	} else if (!robuxAllowed()) {
		robux = (
			<Label
				text="Відкриття за Robux недоступне для твого акаунта."
				tone="muted"
				size={TEXT_SIZES.small}
				order={5}
			/>
		);
	} else {
		robux = (
			<Button
				text={`Відкрити за R$ ${chest.robuxPrice}`}
				variant="crystal"
				onClick={() => MarketplaceService.PromptProductPurchase(Players.LocalPlayer, productId)}
				disabled={full}
				order={5}
			/>
		);
	}

	return (
		<>
			<Label text={chest.description} tone="muted" order={1} />
			<Card order={2}>
				<Label text="Що може випасти (шанси):" display={true} order={0} />
				{chestOdds(props.chestId).map((line, index) => (
					<OddsRow key={`odds_${index}`} item={line.item} chance={line.chance} order={index + 1} />
				))}
			</Card>
			<Label
				text={`🎁 Предметів: ${formatCount(view.inventory.size(), INVENTORY_LIMIT)}${full ? " · інвентар повний" : ""}`}
				tone={full ? "danger" : "muted"}
				order={3}
			/>
			<BuyButton
				price={chest.dollarPrice}
				money={view.money}
				verb="Відкрити"
				blocked={full}
				onClick={() => sendToServer(OPEN_CHEST_REMOTE, props.chestId)}
				order={4}
			/>
			{robux}
			<Label text="Гра повністю проходиться без Robux." tone="muted" size={TEXT_SIZES.small} order={6} />
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

/** The reveal: the item card pops in and its rarity glow slowly turns, like a shiny drop. */
function ChestResult(props: { item: ItemId; chestId: ChestId }) {
	const def = ITEMS[props.item];
	const color = rarityColor(props.item);
	const [scale, scaleMotion] = useMotion(0.3);
	const [spin, spinMotion] = useMotion(0);
	useEffect(() => {
		scaleMotion.spring(1, { tension: 260, friction: 12 });
		spinMotion.linear(360 * 20, { speed: 40 });
	}, [scaleMotion, spinMotion]);

	return (
		<>
			<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 190)} LayoutOrder={1}>
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(0, 170, 0, 170)}
					BackgroundColor3={color}
				>
					<uiscale Scale={scale} />
					<uicorner CornerRadius={RADIUS.large} />
					<uistroke Color={COLORS.outline} Thickness={STROKE.heavy} />
					<uigradient
						Rotation={spin}
						Color={
							new ColorSequence([
								new ColorSequenceKeypoint(0, COLORS.white),
								new ColorSequenceKeypoint(0.5, Color3.fromRGB(150, 150, 150)),
								new ColorSequenceKeypoint(1, COLORS.white),
							])
						}
					/>
					<textlabel
						BackgroundTransparency={1}
						Size={new UDim2(1, 0, 1, 0)}
						Text={KIND_ICONS[def.kind]}
						TextSize={90}
						Font={FONTS.display}
					/>
				</frame>
			</frame>
			<Label
				text={def.name}
				display={true}
				size={TEXT_SIZES.huge}
				color={color}
				align="center"
				outlined={true}
				order={2}
			/>
			<Label
				text={`${RARITY_NAMES[def.rarity]} · ${KIND_NAMES[def.kind]}`}
				color={color}
				align="center"
				order={3}
			/>
			<Label text={effectText(def.kind, def.bonus)} size={TEXT_SIZES.large} align="center" order={4} />
			<Label
				text="Предмет уже в інвентарі. Екіпіруй його в меню «Екіпірування»."
				tone="muted"
				align="center"
				order={5}
			/>
			<Button text="Ще раз" onClick={() => openChest(props.chestId)} order={6} />
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
				title: "Скриня відкрита!",
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
