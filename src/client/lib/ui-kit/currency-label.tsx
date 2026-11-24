import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import { formatMoney } from "shared/lib/format";
import { COLORS, FONTS, TEXT_SIZES } from "./theme";

export interface CurrencyLabelProps {
	readonly value: number;
	readonly size?: number;
	readonly color?: Color3;
	readonly order?: number;
	readonly align?: Enum.TextXAlignment;
}

/**
 * Money that "counts up" to its new value. The number shown is only an animation;
 * the real amount always comes from the server.
 */
export function CurrencyLabel(props: CurrencyLabelProps) {
	const safe = props.value === props.value ? props.value : 0;
	const [shown, shownMotion] = useMotion(safe);
	useEffect(() => {
		shownMotion.spring(safe, { tension: 120, friction: 24 });
	}, [safe, shownMotion]);

	return (
		<textlabel
			BackgroundTransparency={1}
			Size={new UDim2(1, 0, 0, (props.size ?? TEXT_SIZES.large) + 6)}
			Font={FONTS.display}
			Text={shown.map((value) => formatMoney(math.floor(value + 0.5)))}
			TextColor3={props.color ?? COLORS.gold}
			TextSize={props.size ?? TEXT_SIZES.large}
			TextXAlignment={props.align ?? Enum.TextXAlignment.Left}
			LayoutOrder={props.order ?? 0}
		>
			<uistroke Color={COLORS.outline} Thickness={2.5} />
		</textlabel>
	);
}
