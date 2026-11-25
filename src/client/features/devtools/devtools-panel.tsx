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
			text={armed ? "Точно скинути ВСЕ? Натисни ще раз" : "Скинути профіль (новий гравець)"}
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
			<Label text="Лише для тестів у Studio. На живих серверах цього немає." tone="muted" order={0} />
			{DEV_MONEY_AMOUNTS.map((amount, index) => (
				<Button
					key={`money_${amount}`}
					text={`+${formatMoney(amount)}`}
					onClick={() => sendToServer(DEV_COMMAND_REMOTE, "money", amount)}
					order={1 + index}
				/>
			))}
			<Button
				text="Максимальне спорядження"
				variant="crystal"
				onClick={() => sendToServer(DEV_COMMAND_REMOTE, "maxGear")}
				order={50}
			/>
			<Button
				text="+30 руди й матеріалів на склад"
				variant="crystal"
				onClick={() => sendToServer(DEV_COMMAND_REMOTE, "materials")}
				order={52}
			/>
			<Button
				text="Відкрити всі шари"
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
				<Label text="Тексти" display={true} size={TEXT_SIZES.large} order={1} />
				<Label text="Звичайний текст: так виглядають описи в панелях." order={2} />
				<Label text="Приглушений текст для пояснень." tone="muted" order={3} />
				<Label text="Успіх · Небезпека · Кристал" tone="success" order={4} />
				<Label text="Небезпека" tone="danger" order={5} />
				<Label text="Рідкісне" tone="crystal" order={6} />
			</Card>
			<Card order={2}>
				<Label text="Гроші, що «докручуються»" display={true} order={1} />
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
				<Label text="Шкали прогресу" display={true} order={1} />
				<ProgressBar progress={progress} order={2} />
				<ProgressBar progress={progress} color={COLORS.gold} height={20} text="12/25" order={3} />
				<ProgressBar progress={0 / 0} color={COLORS.canyon} height={20} text="NaN = порожня" order={4} />
				<Button
					text="Випадкове значення"
					variant="secondary"
					onClick={() => setProgress(math.random())}
					order={5}
				/>
			</Card>
			<Card order={4}>
				<Label text="Кнопки" display={true} order={1} />
				<Button text="Головна" onClick={() => toast("Головна кнопка", "info")} order={2} />
				<Button text="Успіх" variant="success" onClick={() => toast("Вийшло!", "success")} order={3} />
				<Button text="Небезпека" variant="danger" onClick={() => toast("Помилка!", "error")} order={4} />
				<Button text="Кристал" variant="crystal" onClick={() => toast("Рідкісне", "info")} order={5} />
				<Button text="Звичайна" variant="secondary" onClick={() => toast("Звичайна", "info")} order={6} />
				<Button text="Вимкнена" onClick={() => undefined} disabled={true} order={7} />
				<BuyButton
					price={500}
					money={money}
					verb="Купити"
					onClick={() => toast("Куплено", "success")}
					order={8}
				/>
				<BuyButton price={money + 999} money={money} verb="Купити" onClick={() => undefined} order={9} />
			</Card>
			<Card order={5}>
				<Label text="Значки HUD" display={true} order={1} />
				<Stack direction="horizontal" gap={12} order={2}>
					<StatTile icon="🕳" value="1/3" tooltip="Найглибший шар: Сірі Пласти (1/3)" order={1} />
					<StatTile icon="📦" value="180/200" tooltip="Склад: 180/200" tone="danger" order={2} />
					<StatTile icon="✨" value="×1.25" tooltip="Бонуси: продаж ×1.25" tone="success" order={3} />
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
		() => openPanel({ key: "devtools", title: "Dev-інструменти", icon: "🛠", render: () => <DevPanel /> }),
		90,
		"slate",
	);
}
