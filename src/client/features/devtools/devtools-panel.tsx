// Dev panel and UI showcase. Shown only in Studio; the server enforces the same rule for commands,
// so hiding the buttons here is just tidiness.
import React, { useState } from "@rbxts/react";
import { RunService } from "@rbxts/services";
import { DEV_COMMAND_REMOTE, DEV_MONEY_AMOUNTS } from "shared/features/devtools";
import { formatMoney } from "shared/lib/format";
import { registerHudButton } from "client/features/hud";
import { openPanel } from "client/lib/panels";
import { sendToServer } from "client/lib/remotes";
import { toast } from "client/lib/toasts";
import {
	BuyButton,
	Button,
	ButtonRow,
	COLORS,
	Card,
	CurrencyLabel,
	Label,
	ProgressBar,
	Stack,
	StatTile,
	TEXT_SIZES,
	rowItemWidth,
} from "client/lib/ui-kit";

/** Two presses: the first arms the button, the second resets. A reset wipes the whole test profile. */
function ResetProfileButton(props: { order: number }) {
	const [armed, setArmed] = useState(false);
	return (
		<Button
			text={armed ? "Really reset EVERYTHING? Press again" : "Reset profile (new player)"}
			variant="danger"
			onClick={() => {
				if (!armed) {
					setArmed(true);
					task.delay(4, () => setArmed(false));
					return;
				}
				setArmed(false);
				sendToServer(DEV_COMMAND_REMOTE, "resetProfile");
			}}
			order={props.order}
		/>
	);
}

function DevPanel() {
	return (
		<>
			<Label text="Studio tests only. Live servers do not have this." tone="muted" order={0} />
			{DEV_MONEY_AMOUNTS.map((amount, index) => (
				<Button
					key={`money_${amount}`}
					text={`+${formatMoney(amount)}`}
					onClick={() => sendToServer(DEV_COMMAND_REMOTE, "money", amount)}
					order={1 + index}
				/>
			))}
			<Button
				text="Max gear"
				variant="crystal"
				onClick={() => sendToServer(DEV_COMMAND_REMOTE, "maxGear")}
				order={50}
			/>
			<Button
				text="+30 of every ore to the bag"
				variant="crystal"
				onClick={() => sendToServer(DEV_COMMAND_REMOTE, "ores")}
				order={52}
			/>
			<Button
				text="+100 crystals"
				variant="crystal"
				onClick={() => sendToServer(DEV_COMMAND_REMOTE, "crystals")}
				order={53}
			/>
			<Button
				text="Open all layers"
				variant="crystal"
				onClick={() => sendToServer(DEV_COMMAND_REMOTE, "openLayers")}
				order={51}
			/>
			<ResetProfileButton order={59} />
			<Button text="🎨 UI showcase" variant="secondary" onClick={openShowcase} order={60} />
		</>
	);
}

/** Every UI kit component in one place, to check the look on PC and in the phone emulator. */
function Showcase() {
	const [money, setMoney] = useState(1250);
	const [progress, setProgress] = useState(0.35);
	return (
		<>
			<Card order={1}>
				<Label text="Texts" display={true} size={TEXT_SIZES.large} order={1} />
				<Label text="Normal text: how panel descriptions look." order={2} />
				<Label text="Muted text for explanations." tone="muted" order={3} />
				<Label text="Success · Danger · Crystal" tone="success" order={4} />
				<Label text="Danger" tone="danger" order={5} />
				<Label text="Rare" tone="crystal" order={6} />
			</Card>
			<Card order={2}>
				<Label text="Money that rolls up" display={true} order={1} />
				<CurrencyLabel value={money} size={TEXT_SIZES.huge} order={2} />
				<ButtonRow count={2} order={3}>
					<Button text="+ $5K" onClick={() => setMoney(money + 5000)} width={rowItemWidth(2)} order={1} />
					<Button
						text="× 100"
						variant="crystal"
						onClick={() => setMoney(money * 100)}
						width={rowItemWidth(2)}
						order={2}
					/>
				</ButtonRow>
			</Card>
			<Card order={3}>
				<Label text="Progress bars" display={true} order={1} />
				<ProgressBar progress={progress} order={2} />
				<ProgressBar progress={progress} color={COLORS.gold} height={20} text="12/25" order={3} />
				<ProgressBar progress={0 / 0} color={COLORS.canyon} height={20} text="NaN = empty" order={4} />
				<Button text="Random value" variant="secondary" onClick={() => setProgress(math.random())} order={5} />
			</Card>
			<Card order={4}>
				<Label text="Buttons" display={true} order={1} />
				<Button text="Primary" onClick={() => toast("Primary button", "info")} order={2} />
				<Button text="Success" variant="success" onClick={() => toast("It worked!", "success")} order={3} />
				<Button text="Danger" variant="danger" onClick={() => toast("Error!", "error")} order={4} />
				<Button text="Crystal" variant="crystal" onClick={() => toast("Rare", "info")} order={5} />
				<Button text="Secondary" variant="secondary" onClick={() => toast("Secondary", "info")} order={6} />
				<Button text="Disabled" onClick={() => undefined} disabled={true} order={7} />
				<BuyButton price={500} money={money} verb="Buy" onClick={() => toast("Bought", "success")} order={8} />
				<BuyButton price={money + 999} money={money} verb="Buy" onClick={() => undefined} order={9} />
			</Card>
			<Card order={5}>
				<Label text="HUD tiles" display={true} order={1} />
				<Stack direction="horizontal" gap={12} order={2}>
					<StatTile icon="🕳" value="1/3" tooltip="Deepest layer: Grey Strata (1/3)" order={1} />
					<StatTile icon="📦" value="180/200" tooltip="Storage: 180/200" tone="danger" order={2} />
					<StatTile icon="✨" value="×1.25" tooltip="Bonuses: sell ×1.25" tone="success" order={3} />
				</Stack>
			</Card>
		</>
	);
}

function openShowcase(): void {
	openPanel({ key: "showcase", title: "UI showcase", icon: "🎨", render: () => <Showcase /> });
}

export function startDevtoolsController(): void {
	if (!RunService.IsStudio()) {
		return;
	}
	registerHudButton(
		"🛠",
		"Dev",
		() => openPanel({ key: "devtools", title: "Dev tools", icon: "🛠", render: () => <DevPanel /> }),
		90,
		"slate",
	);
}
