// The map author's SellStation at the end of the belt (decision 044). Besides selling what the belt brings, the player
// can sell the whole bag of raw ore here (E): the station is tagged SellZone at runtime, so the selling feature's
// prompt, panel and server check apply. Its boards show live numbers in each viewer's language:
//   SignText.Title "SELL", PriceScreen.PriceList: Title, Ore (raw ore x1), Ingot (what the player's line multiplies
//   ore by), Part (what the bag is worth right now), ButtonText.Label (the key hint).
import { CollectionService } from "@rbxts/services";
import { STAGE_VALUE } from "shared/config/line";
import { SELL_STATION, TAGS } from "shared/config/map-contract";
import { ORES, ORE_IDS } from "shared/config/ores";
import { Text, text } from "shared/features/i18n";
import { ProfileData } from "shared/features/profile";
import { previewSale } from "shared/features/selling";
import { formatMoney } from "shared/lib/format";
import { localizeLabel } from "server/lib/localized";

/** The last text set on each label, so an unchanged board sends nothing to clients. */
const lastText = new WeakMap<TextLabel, string>();

function setLabel(station: Instance, path: ReadonlyArray<string>, value: Text): void {
	let current: Instance | undefined = station;
	for (const name of path) {
		current = current?.FindFirstChild(name, name === "SurfaceGui");
	}
	if (current === undefined || !current.IsA("TextLabel")) {
		return;
	}
	const key = `${value.key}|${tostring(value.params?.value ?? "")}`;
	if (lastText.get(current) === key) {
		return;
	}
	lastText.set(current, key);
	localizeLabel(current, value);
}

/** Finds the station in a built Factory folder and makes it a place to sell the bag. */
export function setupSellStation(built: Instance): Instance | undefined {
	const station = built.FindFirstChild(SELL_STATION.Model);
	if (station === undefined) {
		return undefined;
	}
	// The tag goes on the counter button part, so the sell prompt and the distance check sit at the counter.
	const button = station.FindFirstChild(SELL_STATION.ButtonLabel[0]);
	const zone =
		button !== undefined && button.IsA("BasePart")
			? button
			: station.IsA("Model")
				? (station.PrimaryPart ?? station.FindFirstChildWhichIsA("BasePart", true))
				: undefined;
	if (zone !== undefined) {
		CollectionService.AddTag(zone, TAGS.SellZone);
	}
	setLabel(station, SELL_STATION.SignTitle, text("sell.stationTitle"));
	setLabel(station, SELL_STATION.PriceTitle, text("sell.pricesTitle"));
	setLabel(station, SELL_STATION.PriceOre, text("sell.priceOre"));
	setLabel(station, SELL_STATION.ButtonLabel, text("sell.stationButton"));
	return station;
}

/** Updates the live lines of the owner's station: line multiplier and bag value. Cheap; called every line tick. */
export function refreshSellStation(station: Instance, data: ProfileData, sellMultiplier: number): void {
	const owned = data.line.machines.size();
	const lineMultiplier = STAGE_VALUE[math.min(owned, STAGE_VALUE.size() - 1)];
	setLabel(station, SELL_STATION.PriceIngot, text("sell.priceLine", { value: `×${lineMultiplier}` }));
	const bag = previewSale(data.bag, ORE_IDS, ORES, sellMultiplier);
	setLabel(station, SELL_STATION.PricePart, text("sell.priceBag", { value: formatMoney(bag.total) }));
}
