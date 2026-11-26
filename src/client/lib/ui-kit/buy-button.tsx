import { t } from "../i18n";
import React from "@rbxts/react";
import { formatCompact, formatMoney } from "shared/lib/format";
import { Button } from "./button";

export interface BuyButtonProps {
	readonly price: number;
	readonly money: number;
	/** The verb in the player's language: t("common.buy"), t("common.open")... */
	readonly verb: string;
	readonly onClick: () => void;
	/** Extra reason the purchase is impossible right now (e.g. inventory full). */
	readonly blocked?: boolean;
	readonly order?: number;
	readonly width?: UDim;
	readonly height?: number;
	readonly textSize?: number;
	/** Shown before the verb, e.g. "✨". */
	readonly icon?: string;
	/** What `price` and `money` count: dollars (default) or crystals (decision 043). */
	readonly currency?: "money" | "crystals";
}

function formatPrice(value: number, currency: "money" | "crystals" | undefined): string {
	return currency === "crystals" ? `💎 ${formatCompact(value)}` : formatMoney(value);
}

/**
 * A purchase button that always tells the truth about money: "Buy for $500" or "$500 (short $120)".
 * Only a hint: the server checks the price again.
 */
export function BuyButton(props: BuyButtonProps) {
	const affordable = props.money >= props.price;
	const text = affordable
		? `${props.icon !== undefined ? `${props.icon}  ` : ""}${t("common.buyFor", { verb: props.verb, price: formatPrice(props.price, props.currency) })}`
		: t("common.short", {
				price: formatPrice(props.price, props.currency),
				missing: formatPrice(props.price - props.money, props.currency),
			});
	return (
		<Button
			text={text}
			onClick={props.onClick}
			disabled={!affordable || props.blocked === true}
			variant="success"
			shine={affordable && props.blocked !== true}
			order={props.order}
			width={props.width}
			height={props.height}
			textSize={props.textSize}
		/>
	);
}
