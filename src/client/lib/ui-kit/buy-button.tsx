import { t } from "../i18n";
import React from "@rbxts/react";
import { formatMoney } from "shared/lib/format";
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
}

/**
 * A purchase button that always tells the truth about money: "Buy for $500" or "$500 (short $120)".
 * Only a hint: the server checks the price again.
 */
export function BuyButton(props: BuyButtonProps) {
	const affordable = props.money >= props.price;
	const text = affordable
		? `${props.icon !== undefined ? `${props.icon}  ` : ""}${t("common.buyFor", { verb: props.verb, price: formatMoney(props.price) })}`
		: t("common.short", { price: formatMoney(props.price), missing: formatMoney(props.price - props.money) });
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
