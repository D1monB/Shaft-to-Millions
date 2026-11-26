// The developer panel (decision 068): pick a player, give money or crystals, bring them, kick them; the owner also
// grants the developer role and creates promo codes. Every button only asks; the server checks the sender's role.
import React, { useEffect, useState } from "@rbxts/react";
import { Players } from "@rbxts/services";
import { ADMIN_ACTION_REMOTE, AdminAction } from "shared/features/admin";
import { CREATE_CODE_REMOTE, DELETE_CODE_REMOTE } from "shared/features/promo";
import { formatMoney } from "shared/lib/format";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";
import { TextField } from "client/lib/text-field";
import { Button, ButtonRow, Card, Label, TEXT_SIZES, rowItemWidth } from "client/lib/ui-kit";
import { ownRole } from "./role";

const MONEY_PRESETS: ReadonlyArray<number> = [1_000, 100_000, 10_000_000];
const CRYSTAL_PRESETS: ReadonlyArray<number> = [50, 500];

function usePlayers(): Player[] {
	const [list, setList] = useState(Players.GetPlayers());
	useEffect(() => {
		const added = Players.PlayerAdded.Connect(() => setList(Players.GetPlayers()));
		const removed = Players.PlayerRemoving.Connect((gone) =>
			setList(Players.GetPlayers().filter((player) => player !== gone)),
		);
		return () => {
			added.Disconnect();
			removed.Disconnect();
		};
	}, []);
	return list;
}

function TargetActions(props: { target: Player; owner: boolean }) {
	const [custom, setCustom] = useState("");
	const send = (action: AdminAction, amount?: number) => {
		if (amount !== undefined) {
			sendToServer(ADMIN_ACTION_REMOTE, action, props.target.UserId, amount);
		} else {
			sendToServer(ADMIN_ACTION_REMOTE, action, props.target.UserId);
		}
	};
	const customAmount = tonumber(custom);
	const isMe = props.target === Players.LocalPlayer;
	// Kick and reset need a second tap, so a slip never removes or wipes anyone.
	const [armed, setArmed] = useState("");
	const confirmed = (action: AdminAction) => () => {
		if (armed === `${action}:${props.target.UserId}`) {
			setArmed("");
			send(action);
		} else {
			setArmed(`${action}:${props.target.UserId}`);
		}
	};
	const isArmed = (action: AdminAction) => armed === `${action}:${props.target.UserId}`;
	return (
		<Card order={3} gap={6}>
			<Label text={props.target.Name} display={true} size={TEXT_SIZES.large} order={1} />
			<ButtonRow count={3} order={2}>
				{MONEY_PRESETS.map((amount, index) => (
					<Button
						key={amount}
						text={`+${formatMoney(amount)}`}
						variant="primary"
						width={rowItemWidth(3)}
						onClick={() => send("money", amount)}
						order={index}
					/>
				))}
			</ButtonRow>
			<ButtonRow count={2} order={3}>
				{CRYSTAL_PRESETS.map((amount, index) => (
					<Button
						key={amount}
						text={`+${amount} 💎`}
						variant="crystal"
						width={rowItemWidth(2)}
						onClick={() => send("crystals", amount)}
						order={index}
					/>
				))}
			</ButtonRow>
			<TextField placeholder={t("admin.customMoney")} value={custom} onChange={setCustom} order={4} />
			<Button
				text={t("admin.giveCustom")}
				disabled={customAmount === undefined || customAmount < 1}
				onClick={() => send("money", math.floor(customAmount ?? 0))}
				order={5}
			/>
			<Button
				text={t("admin.takeCustom")}
				variant="danger"
				disabled={customAmount === undefined || customAmount < 1}
				onClick={() => send("takeMoney", math.floor(customAmount ?? 0))}
				order={5}
			/>
			<Button
				text={t("admin.takeCrystals", { count: 500 })}
				variant="slate"
				onClick={() => send("takeCrystals", 500)}
				order={5}
			/>
			<ButtonRow count={2} order={5}>
				<Button text={t("admin.heal")} width={rowItemWidth(2)} onClick={() => send("heal")} order={1} />
				<Button text={t("admin.unlock")} width={rowItemWidth(2)} onClick={() => send("unlock")} order={2} />
			</ButtonRow>
			<ButtonRow count={2} order={5}>
				<Button text={t("admin.boost")} width={rowItemWidth(2)} onClick={() => send("boost")} order={1} />
				<Button text={t("admin.spins")} width={rowItemWidth(2)} onClick={() => send("spins")} order={2} />
			</ButtonRow>
			{!isMe && <Button text={t("admin.goto")} variant="secondary" onClick={() => send("goto")} order={5} />}
			{!isMe && (
				<ButtonRow count={2} order={6}>
					<Button text={t("admin.bring")} width={rowItemWidth(2)} onClick={() => send("bring")} order={1} />
					<Button
						text={isArmed("kick") ? t("admin.confirm") : t("admin.kick")}
						variant="danger"
						width={rowItemWidth(2)}
						onClick={confirmed("kick")}
						order={2}
					/>
				</ButtonRow>
			)}
			{props.owner && !isMe && (
				<ButtonRow count={2} order={7}>
					<Button
						text={t("admin.grant")}
						variant="success"
						width={rowItemWidth(2)}
						onClick={() => send("grant")}
						order={1}
					/>
					<Button
						text={t("admin.revoke")}
						variant="slate"
						width={rowItemWidth(2)}
						onClick={() => send("revoke")}
						order={2}
					/>
				</ButtonRow>
			)}
			{props.owner && (
				<Button
					text={isArmed("reset") ? t("admin.confirm") : t("admin.reset")}
					variant="danger"
					onClick={confirmed("reset")}
					order={8}
				/>
			)}
		</Card>
	);
}

/** The owner's promo code maker. Codes are saved only in the game's DataStore. */
function CodeMaker() {
	const [code, setCode] = useState("");
	const [money, setMoney] = useState("1000");
	const [crystals, setCrystals] = useState("0");
	const [uses, setUses] = useState("100");
	return (
		<Card order={4} gap={6}>
			<Label text={t("admin.codes")} display={true} order={1} />
			<TextField placeholder={t("admin.codeName")} value={code} onChange={setCode} order={2} />
			<TextField placeholder={t("admin.codeMoney")} value={money} onChange={setMoney} order={3} />
			<TextField placeholder={t("admin.codeCrystals")} value={crystals} onChange={setCrystals} order={4} />
			<TextField placeholder={t("admin.codeUses")} value={uses} onChange={setUses} order={5} />
			<ButtonRow count={2} order={6}>
				<Button
					text={t("admin.codeCreate")}
					variant="success"
					width={rowItemWidth(2)}
					onClick={() =>
						sendToServer(
							CREATE_CODE_REMOTE,
							code,
							tonumber(money) ?? -1,
							tonumber(crystals) ?? -1,
							tonumber(uses) ?? -1,
						)
					}
					order={1}
				/>
				<Button
					text={t("admin.codeDelete")}
					variant="danger"
					width={rowItemWidth(2)}
					onClick={() => sendToServer(DELETE_CODE_REMOTE, code)}
					order={2}
				/>
			</ButtonRow>
		</Card>
	);
}

export function AdminPanel() {
	const players = usePlayers();
	const [selected, setSelected] = useState(Players.LocalPlayer.UserId);
	const owner = ownRole() === "owner";
	const target = players.find((player) => player.UserId === selected);
	return (
		<>
			<Label text={t("admin.pickPlayer")} tone="muted" order={1} />
			<Card order={2} gap={4}>
				{players.map((player, index) => (
					<Button
						key={player.UserId}
						text={player === Players.LocalPlayer ? `${player.Name} (${t("admin.me")})` : player.Name}
						variant={player.UserId === selected ? "primary" : "secondary"}
						height={34}
						onClick={() => setSelected(player.UserId)}
						order={index}
					/>
				))}
			</Card>
			{target !== undefined && <TargetActions target={target} owner={owner} />}
			{owner && <CodeMaker />}
		</>
	);
}
