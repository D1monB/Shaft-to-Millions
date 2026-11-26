// The store panel (decision 057): boosters for crystals (the free path) or Robux, crystal and money packs for Robux.
// Every button only asks: crystals go through BuyBoost (the server checks and charges), Robux through Roblox's own
// purchase prompt (the server grants in ProcessReceipt). Robux items stay hidden until their product id is set.
import React from "@rbxts/react";
import { MarketplaceService, Players } from "@rbxts/services";
import { BOOSTERS, BOOSTER_IDS, BoosterId, CRYSTAL_PORTION_SECONDS } from "shared/config/boosters";
import { StringKey } from "shared/config/i18n";
import { StoreProduct } from "shared/config/store";
import { baseEffects } from "shared/features/base";
import { BUY_BOOST_REMOTE, boostSecondsLeft } from "shared/features/boosters";
import { ROBUX_CHESTS_ALLOWED_ATTRIBUTE } from "shared/features/chests";
import { PlayerView } from "shared/features/profile";
import { moneyPackAmount, visibleProducts } from "shared/features/store";
import { formatDuration, formatMoney } from "shared/lib/format";
import { useView } from "client/features/profile";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";
import { Button, COLORS, Card, Label, TEXT_SIZES } from "client/lib/ui-kit";

function buyRobux(product: StoreProduct): void {
	const productId = product.productId;
	if (productId !== undefined) {
		MarketplaceService.PromptProductPurchase(Players.LocalPlayer, productId);
	}
}

function robuxText(product: StoreProduct): string {
	return `R$ ${product.robuxPrice}`;
}

function BoosterCard(props: { id: BoosterId; view: PlayerView; products: StoreProduct[]; order: number }) {
	const def = BOOSTERS[props.id];
	const left = boostSecondsLeft(props.view.boosts, props.id, os.time());
	const robux = props.products.find(
		(product) =>
			product.grant.kind === "boost" &&
			product.grant.boosters.size() === 1 &&
			product.grant.boosters[0] === props.id,
	);
	return (
		<Card gap={6} order={props.order} accent={left > 0 ? COLORS.gold : undefined}>
			<Label text={t(`booster.${props.id}` as StringKey)} display={true} order={1} />
			<Label text={t(`booster.${props.id}.hint` as StringKey)} tone="muted" size={TEXT_SIZES.small} order={2} />
			<Label
				text={left > 0 ? t("store.timeLeft", { time: formatDuration(left) }) : t("store.off")}
				tone={left > 0 ? "success" : "muted"}
				size={TEXT_SIZES.small}
				order={3}
			/>
			<Button
				text={t("store.forCrystals", {
					minutes: math.floor((CRYSTAL_PORTION_SECONDS + baseEffects(props.view.base).boostSeconds) / 60),
					price: def.crystalPrice,
				})}
				variant="primary"
				disabled={props.view.crystals < def.crystalPrice}
				height={40}
				onClick={() => sendToServer(BUY_BOOST_REMOTE, props.id)}
				order={4}
			/>
			{robux !== undefined && (
				<Button
					text={robuxText(robux)}
					variant="success"
					height={40}
					onClick={() => buyRobux(robux)}
					order={5}
				/>
			)}
		</Card>
	);
}

function PackButton(props: { product: StoreProduct; view: PlayerView; order: number }) {
	const grant = props.product.grant;
	let label = "";
	if (grant.kind === "crystals") {
		label = `+${grant.amount} 💎`;
	} else if (grant.kind === "money") {
		label = `+${formatMoney(moneyPackAmount(grant.amount, props.view.deepestLayer))}`;
	} else {
		label = t("store.allBoosters", { hours: grant.seconds / 3600 });
	}
	return (
		<Button
			text={`${label}   ·   ${robuxText(props.product)}`}
			variant="success"
			height={46}
			onClick={() => buyRobux(props.product)}
			order={props.order}
		/>
	);
}

function StoreList(props: { view: PlayerView }) {
	const randomAllowed = Players.LocalPlayer.GetAttribute(ROBUX_CHESTS_ALLOWED_ATTRIBUTE) === true;
	const products = visibleProducts(randomAllowed);
	const elements: React.Element[] = [<Label key="boostTitle" text={t("store.boosters")} display={true} order={1} />];
	BOOSTER_IDS.forEach((id, index) => {
		elements.push(<BoosterCard key={id} id={id} view={props.view} products={products} order={2 + index} />);
	});
	const bundles = products.filter((product) => product.grant.kind === "boost" && product.grant.boosters.size() > 1);
	const crystals = products.filter((product) => product.grant.kind === "crystals");
	const money = products.filter((product) => product.grant.kind === "money");
	let order = 10;
	for (const product of bundles) {
		elements.push(<PackButton key={product.id} product={product} view={props.view} order={order++} />);
	}
	if (crystals.size() > 0) {
		elements.push(<Label key="crystalTitle" text={t("store.crystals")} display={true} order={order++} />);
		for (const product of crystals) {
			elements.push(<PackButton key={product.id} product={product} view={props.view} order={order++} />);
		}
	}
	if (money.size() > 0) {
		elements.push(<Label key="moneyTitle" text={t("store.money")} display={true} order={order++} />);
		for (const product of money) {
			elements.push(<PackButton key={product.id} product={product} view={props.view} order={order++} />);
		}
	}
	if (products.size() === 0) {
		elements.push(<Label key="soon" text={t("store.robuxSoon")} tone="muted" order={order++} />);
	}
	return <>{elements}</>;
}

export function StorePanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	return <StoreList view={view} />;
}
