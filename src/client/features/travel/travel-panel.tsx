// Fast travel panel: the surface and every camp the player has opened. The list comes from the same shared rules
// the server uses, so a button is never shown for a trip the server would refuse.
import React from "@rbxts/react";
import { LAYERS } from "shared/config/layers";
import { PlayerView } from "shared/features/profile";
import { SURFACE, TRAVEL_COOLDOWN, TRAVEL_REMOTE, travelDestinations } from "shared/features/travel";
import { registerHudButton } from "client/features/hud";
import { useView } from "client/features/profile";
import { closePanel, openPanel } from "client/lib/panels";
import { sendToServer } from "client/lib/remotes";
import { Button, Label } from "client/lib/ui-kit";

function destinationName(destination: number): string {
	if (destination === SURFACE) {
		return "🏠 Поверхня";
	}
	return `⛏ Табір: ${LAYERS[destination]?.name ?? destination}`;
}

function TravelList(props: { view: PlayerView }) {
	const destinations = travelDestinations(props.view.deepestLayer);
	return (
		<>
			<Label
				text={`Подорож безкоштовна, але між подорожами пауза ${TRAVEL_COOLDOWN} с.`}
				tone="muted"
				order={1}
			/>
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
				<Label
					text="Табори відкриваються, коли торкнешся їх у шахті."
					tone="muted"
					order={destinations.size() + 2}
				/>
			)}
		</>
	);
}

function TravelPanel() {
	const view = useView();
	if (view === undefined) {
		return <Label text="Завантаження..." tone="muted" />;
	}
	return <TravelList view={view} />;
}

export function startTravelController(): void {
	registerHudButton(
		"🧭",
		"Подорож",
		() => openPanel({ key: "travel", title: "Швидка подорож", icon: "🧭", render: () => <TravelPanel /> }),
		20,
	);
}
