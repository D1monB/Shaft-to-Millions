// Screen-level hosts: the single open panel and the toast stack.
import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import { NotifyKind } from "shared/lib/remote-names";
import { closePanel, useOpenPanel } from "../panels";
import { ToastEntry, toastText, useToasts } from "../toasts";
import { Panel } from "./panel";
import { COLORS, FONTS, RADIUS, SPRINGS, STROKE, TEXT_SIZES } from "./theme";

export function PanelHost() {
	const spec = useOpenPanel();
	if (spec === undefined) {
		return undefined;
	}
	// The key remounts the panel (and replays its pop-in) when a different panel opens.
	return (
		<Panel
			key={spec.key}
			title={spec.title}
			icon={spec.icon}
			accent={spec.accent}
			footer={spec.footer?.()}
			onClose={closePanel}
		>
			{spec.render()}
		</Panel>
	);
}

const TOAST_COLORS: { [K in NotifyKind]: Color3 } = {
	info: COLORS.woodLight,
	success: COLORS.successDark,
	error: COLORS.canyonDark,
};

function Toast(props: { entry: ToastEntry; order: number }) {
	// Fades in instead of sliding: a slide moved the label outside its wrapper, so the wrapper was shorter than the
	// toast for a moment and the next toast was drawn over it (the stack looked overlapped).
	const [fade, fadeMotion] = useMotion(1);
	useEffect(() => {
		fadeMotion.spring(0, SPRINGS.bouncy);
	}, [fadeMotion]);
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(1, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			LayoutOrder={props.order}
		>
			<textlabel
				Size={new UDim2(1, 0, 0, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={fade}
				TextTransparency={fade}
				BackgroundColor3={TOAST_COLORS[props.entry.kind]}
				Font={FONTS.display}
				Text={toastText(props.entry)}
				TextSize={TEXT_SIZES.body}
				TextColor3={COLORS.text}
				TextWrapped={true}
			>
				<uicorner CornerRadius={RADIUS.medium} />
				<uistroke
					Color={COLORS.outline}
					Thickness={STROKE.thick}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				<uipadding
					PaddingTop={new UDim(0, 8)}
					PaddingBottom={new UDim(0, 8)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>
			</textlabel>
		</frame>
	);
}

export function ToastHost() {
	const toasts = useToasts();
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, 96)}
			Size={new UDim2(0, 380, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundTransparency={1}
			ZIndex={20}
		>
			<uilistlayout Padding={new UDim(0, 6)} SortOrder={Enum.SortOrder.LayoutOrder} />
			{toasts.map((entry) => (
				<Toast key={`toast_${entry.id}`} entry={entry} order={entry.id} />
			))}
		</frame>
	);
}
