// The visual pieces of the sell panel (decision 062): a card per ore with its 3D model, the big total banner and the
// bonus chips. Looks only; every number comes in as a prop from the panel.
import React from "@rbxts/react";
import { ORES, OreId } from "shared/config/ores";
import { Rarity } from "shared/config/items";
import { nameKeys } from "shared/features/i18n";
import { formatMoney } from "shared/lib/format";
import { t } from "client/lib/i18n";
import { ITEM_CARD_HEIGHT, ITEM_CARD_WIDTH, RarityCard } from "client/lib/item-card";
import { RARITY_LIGHT, RARITY_RAMPS } from "client/lib/item-display";
import { oreTemplate } from "client/lib/model-icon";
import { CardStrip, COLORS, FONTS, RADIUS, StripSlot, Sunburst } from "client/lib/ui-kit";

/** Deeper ore shines brighter: a copper card is plain, an iridium card turns light rays. */
const ORE_RARITY: { readonly [K in OreId]: Rarity } = {
	copper: "common",
	iron: "common",
	silver: "rare",
	gold: "epic",
	titanium: "epic",
	iridium: "legendary",
};

export interface SaleRow {
	readonly id: OreId;
	readonly count: number;
	readonly subtotal: number;
}

export function OreStrip(props: { rows: ReadonlyArray<SaleRow>; order: number }) {
	return (
		<CardStrip cardWidth={ITEM_CARD_WIDTH} cardHeight={ITEM_CARD_HEIGHT} order={props.order}>
			{props.rows.map((row, index) => {
				const rarity = ORE_RARITY[row.id];
				return (
					<StripSlot key={row.id} width={ITEM_CARD_WIDTH} height={ITEM_CARD_HEIGHT} order={index}>
						<RarityCard
							ramp={RARITY_RAMPS[rarity]}
							light={RARITY_LIGHT[rarity]}
							icon="🪨"
							model={oreTemplate(row.id)}
							name={t(nameKeys.ore(row.id))}
							pill={`×${row.count}`}
							effect={formatMoney(row.subtotal)}
							topRight={{
								text: t("sell.each", { money: formatMoney(ORES[row.id].price) }),
								color: COLORS.gold,
							}}
							rays={rarity === "legendary"}
						/>
					</StripSlot>
				);
			})}
		</CardStrip>
	);
}

export interface Chip {
	readonly text: string;
	readonly color: Color3;
}

/** Small coloured bonus labels in a row. */
function ChipRow(props: { chips: ReadonlyArray<Chip> }) {
	return (
		<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 24)} Position={new UDim2(0, 0, 1, -30)} ZIndex={4}>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 6)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{props.chips.map((chip, index) => (
				<frame
					key={`chip_${index}`}
					BackgroundColor3={COLORS.outline}
					BackgroundTransparency={0.2}
					Size={new UDim2(0, 0, 1, 0)}
					AutomaticSize={Enum.AutomaticSize.X}
					LayoutOrder={index}
					ZIndex={4}
				>
					<uicorner CornerRadius={RADIUS.round} />
					<uistroke Color={chip.color} Thickness={1.5} />
					<uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} />
					<textlabel
						BackgroundTransparency={1}
						Size={new UDim2(0, 0, 1, 0)}
						AutomaticSize={Enum.AutomaticSize.X}
						Font={FONTS.display}
						Text={chip.text}
						TextSize={14}
						TextColor3={chip.color}
						ZIndex={5}
					/>
				</frame>
			))}
		</frame>
	);
}

const GOLD_SEQUENCE = new ColorSequence(Color3.fromRGB(255, 190, 40), Color3.fromRGB(120, 68, 12));

/** The big gold banner: what the sale pays, with the bonuses that made it. */
export function TotalBanner(props: { total: number; items: number; chips: ReadonlyArray<Chip>; order: number }) {
	const hasChips = props.chips.size() > 0;
	return (
		<canvasgroup
			BackgroundColor3={COLORS.white}
			BorderSizePixel={0}
			Size={new UDim2(1, 0, 0, hasChips ? 128 : 100)}
			LayoutOrder={props.order}
		>
			<uicorner CornerRadius={RADIUS.large} />
			<uigradient Rotation={90} Color={GOLD_SEQUENCE} />
			<Sunburst zIndex={1} color={Color3.fromRGB(255, 236, 150)} />
			<textlabel
				BackgroundTransparency={1}
				Position={new UDim2(0, 0, 0, 8)}
				Size={new UDim2(1, 0, 0, 20)}
				Font={FONTS.display}
				Text={t("sell.youGet", { count: props.items })}
				TextSize={16}
				TextColor3={COLORS.white}
				ZIndex={3}
			>
				<uistroke Color={COLORS.outline} Thickness={2} />
			</textlabel>
			<textlabel
				BackgroundTransparency={1}
				Position={new UDim2(0, 8, 0, 30)}
				Size={new UDim2(1, -16, 0, 56)}
				Font={FONTS.display}
				Text={formatMoney(props.total)}
				TextScaled={true}
				TextColor3={COLORS.white}
				ZIndex={3}
			>
				<uitextsizeconstraint MaxTextSize={52} />
				<uistroke Color={COLORS.outline} Thickness={3.5} />
			</textlabel>
			{hasChips && <ChipRow chips={props.chips} />}
		</canvasgroup>
	);
}
