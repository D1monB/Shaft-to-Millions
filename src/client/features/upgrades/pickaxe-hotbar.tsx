// The hotbar at the bottom of the screen (decision 037): one slot per OWNED pickaxe with its 3D model, replacing
// Roblox's default backpack bar. A tap or keys 1..9, 0 pick a pickaxe (the server equips it and puts it in the hand);
// the pickaxe always stays in the hand (decision 067).
import React, { useEffect, useRef, useState } from "@rbxts/react";
import { Players, StarterGui, UserInputService } from "@rbxts/services";
import { PICKAXES, PickaxeDef } from "shared/config/pickaxes";
import { nameKeys } from "shared/features/i18n";
import { EQUIP_GEAR_REMOTE, PICKAXE_ID_ATTRIBUTE } from "shared/features/upgrades";
import { useView } from "client/features/profile";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";
import { COLORS, FONTS, RADIUS, STROKE, TEXT_SIZES } from "client/lib/ui-kit";
import { CHOSEN_LIFT, HotbarSlot } from "./hotbar-slot";

const SLOT = 60;
/** On a touch screen (phones): smaller, so ten slots leave room for the thumbs. */
const TOUCH_SLOT = 46;

/** Read on every render: PreferredInput follows the device in use, so it switches with the player. */
function slotSize(): number {
	return UserInputService.PreferredInput === Enum.PreferredInput.Touch ? TOUCH_SLOT : SLOT;
}
const GAP = 8;
/** At the bottom edge, like Roblox's own bar; the goal banner moved to the top centre. */
const BOTTOM_OFFSET = 10;
const KEYS: ReadonlyArray<Enum.KeyCode> = [
	Enum.KeyCode.One,
	Enum.KeyCode.Two,
	Enum.KeyCode.Three,
	Enum.KeyCode.Four,
	Enum.KeyCode.Five,
	Enum.KeyCode.Six,
	Enum.KeyCode.Seven,
	Enum.KeyCode.Eight,
	Enum.KeyCode.Nine,
	Enum.KeyCode.Zero,
];

const player = Players.LocalPlayer;

function heldPickaxe(): string | undefined {
	const tool = player.Character?.FindFirstChildOfClass("Tool");
	const id = tool?.GetAttribute(PICKAXE_ID_ATTRIBUTE);
	return typeIs(id, "string") ? id : undefined;
}

/** Re-renders when a tool enters or leaves the character (taken out, put away, swapped, respawn). */
function useHeldPickaxe(): string | undefined {
	const [held, setHeld] = useState(heldPickaxe());
	useEffect(() => {
		const connections: RBXScriptConnection[] = [];
		const watch = (character: Model) => {
			const refresh = () => setHeld(heldPickaxe());
			connections.push(character.ChildAdded.Connect(refresh), character.ChildRemoved.Connect(refresh));
			refresh();
		};
		if (player.Character !== undefined) {
			watch(player.Character);
		}
		connections.push(player.CharacterAdded.Connect(watch));
		return () => connections.forEach((connection) => connection.Disconnect());
	}, []);
	return held;
}

/** Puts the chosen pickaxe away, or takes it out of the backpack again. */
function toggleHold(): void {
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	if (humanoid === undefined) {
		return;
	}
	// The pickaxe is never put away (decision 067).
	if (heldPickaxe() !== undefined) {
		return;
	}
	const tool = player
		.FindFirstChildOfClass("Backpack")
		?.GetChildren()
		.find((child): child is Tool => child.IsA("Tool") && child.GetAttribute(PICKAXE_ID_ATTRIBUTE) !== undefined);
	if (tool !== undefined) {
		humanoid.EquipTool(tool);
	}
}

function choose(def: PickaxeDef, equipped: string): void {
	if (def.id === equipped) {
		toggleHold();
	} else {
		sendToServer(EQUIP_GEAR_REMOTE, def.id);
	}
}

export function PickaxeHotbar() {
	const view = useView();
	const held = useHeldPickaxe();
	const owned = view === undefined ? [] : PICKAXES.filter((def) => view.gear.owned.includes(def.id));
	const equipped = view?.gear.equipped.pickaxe ?? "";

	// Keys 1..9, 0 pick the slot with that number (not while typing in chat or a text box). The listener lives as long
	// as the hotbar and reads the newest slots through the ref.
	const latest = useRef({ owned, equipped });
	latest.current = { owned, equipped };
	useEffect(() => {
		const connection = UserInputService.InputBegan.Connect((input, processed) => {
			const index = KEYS.indexOf(input.KeyCode);
			const def = latest.current.owned[index];
			if (!processed && index >= 0 && def !== undefined) {
				choose(def, latest.current.equipped);
			}
		});
		return () => connection.Disconnect();
	}, []);

	if (owned.size() === 0) {
		return undefined;
	}
	const chosen = PICKAXES.find((def) => def.id === equipped);
	const size = slotSize();
	const trayHeight = size + CHOSEN_LIFT + 14;
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -BOTTOM_OFFSET)}
			Size={UDim2.fromOffset(0, trayHeight + 30)}
			AutomaticSize={Enum.AutomaticSize.X}
			BackgroundTransparency={1}
		>
			{chosen !== undefined && (
				<frame BackgroundTransparency={1} Size={new UDim2(1, 0, 0, 24)}>
					<textlabel
						AnchorPoint={new Vector2(0.5, 0)}
						Position={new UDim2(0.5, 0, 0, 0)}
						Size={new UDim2(0, 0, 0, 24)}
						AutomaticSize={Enum.AutomaticSize.X}
						BackgroundColor3={COLORS.outline}
						BackgroundTransparency={0.25}
						Font={FONTS.display}
						Text={`⛏ ${t(nameKeys.gear(chosen.id))}  ·  ${t("hotbar.power", { power: chosen.power })}`}
						TextSize={TEXT_SIZES.small + 1}
						TextColor3={held === chosen.id ? COLORS.white : COLORS.textMuted}
					>
						<uicorner CornerRadius={RADIUS.round} />
						<uipadding PaddingLeft={new UDim(0, 12)} PaddingRight={new UDim(0, 12)} />
					</textlabel>
				</frame>
			)}
			<frame
				BackgroundColor3={Color3.fromRGB(20, 18, 28)}
				BackgroundTransparency={0.25}
				Position={UDim2.fromOffset(0, 30)}
				Size={UDim2.fromOffset(0, trayHeight)}
				AutomaticSize={Enum.AutomaticSize.X}
			>
				<uicorner CornerRadius={RADIUS.large} />
				<uistroke Color={COLORS.outline} Thickness={STROKE.thick} />
				<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} PaddingTop={new UDim(0, 4)} />
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					Padding={new UDim(0, GAP - 2)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{owned.map((def, index) => (
					<HotbarSlot
						key={def.id}
						def={def}
						index={index}
						size={size}
						keyLabel={index < KEYS.size() ? `${(index + 1) % 10}` : undefined}
						chosen={def.id === equipped}
						onClick={() => choose(def, equipped)}
					/>
				))}
			</frame>
		</frame>
	);
}

/** Our hotbar replaces Roblox's backpack bar. SetCoreGuiEnabled can fail while the core scripts load: retried. */
export function hideDefaultBackpack(): void {
	task.spawn(() => {
		for (let attempt = 0; attempt < 10; attempt++) {
			const [ok] = pcall(() => StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false));
			if (ok) {
				return;
			}
			task.wait(1);
		}
	});
}
