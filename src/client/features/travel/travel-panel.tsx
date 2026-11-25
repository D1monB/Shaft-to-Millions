// Fast travel panel: the surface and every camp the player has opened. The list comes from the same shared rules
// the server uses, so a button is never shown for a trip the server would refuse.
import React from "@rbxts/react";
import { nameKeys } from "shared/features/i18n";
import { t } from "client/lib/i18n";
import { PlayerView } from "shared/features/profile";
import { SURFACE, TRAVEL_COOLDOWN, TRAVEL_REMOTE, travelDestinations } from "shared/features/travel";
import { registerHudButton } from "client/features/hud";
import { useView } from "client/features/profile";
import { closePanel, openPanel } from "client/lib/panels";
import { sendToServer } from "client/lib/remotes";
import { Button, Label } from "client/lib/ui-kit";

function destinationName(destination: number): string {
	if (destination === SURFACE) {
		return t("travel.surface");
	}
	return t("travel.camp", { layer: t(nameKeys.layer(destination)) });
}

function TravelList(props: { view: PlayerView }) {
	const destinations = travelDestinations(props.view.deepestLayer);
	return (
		<>
			<Label text={t("travel.cooldown", { seconds: TRAVEL_COOLDOWN })} tone="muted" order={1} />
			{destinations.map((destination, index) => (
				<Button
					key={destination}
					text={destinationName(destination)}
					variant={destination === SURFACE ? "primary" : "secondary"}
					onClick={() => {
						sendToServer(TRAVEL_REMOTE, destination);
						closePanel();
					}}
					order={index + 2}
				/>
			))}
			{destinations.size() === 1 && (
				<Label text={t("travel.campsHint")} tone="muted" order={destinations.size() + 2} />
			)}
		</>
	);
}

function TravelPanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text={t("common.loading")} tone="muted" />;
	}
	return <TravelList view={view} />;
}

export function startTravelController(): void {
	registerHudButton(
		"🧭",
		() => t("menu.travel"),
		() => openPanel({ key: "travel", title: t("travel.title"), icon: "🧭", render: () => <TravelPanel /> }),
		20,
		"success",
	);
}
