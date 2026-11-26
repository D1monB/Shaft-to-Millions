// The hotbar at the bottom of the screen (decision 037): one slot per OWNED pickaxe with its 3D model, replacing
// Roblox's default backpack bar. A tap or keys 1..9, 0 pick a pickaxe (the server equips it and puts it in the hand);
// picking the one already chosen puts it away or takes it out again.
import React, { useEffect, useRef, useState } from "@rbxts/react";
import { Players, StarterGui, UserInputService } from "@rbxts/services";
import { PICKAXES, PickaxeDef } from "shared/config/pickaxes";
import { nameKeys } from "shared/features/i18n";
import { EQUIP_GEAR_REMOTE, PICKAXE_ID_ATTRIBUTE } from "shared/features/upgrades";
import { ModelIcon, pickaxeTemplate } from "client/lib/model-icon";
import { useView } from "client/features/profile";
import { t } from "client/lib/i18n";
import { sendToServer } from "client/lib/remotes";
import { ACCENTS, COLORS, FONTS, GLASS_TRANSPARENCY, RADIUS, STROKE, TEXT_SIZES } from "client/lib/ui-kit";

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
	if (heldPickaxe() !== undefined) {
		humanoid.UnequipTools();
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

/** The map author's pickaxe model in a ViewportFrame (no image assets needed). */
function PickaxeModel(props: { tool: string }) {
	const template = pickaxeTemplate(props.tool);
	return template === undefined ? undefined : (
		<ModelIcon template={template} size={new UDim2(1, -8, 1, -8)} position={new UDim2(0, 4, 0, 4)} />
	);
}

function Slot(props: { def: PickaxeDef; index: number; chosen: boolean; held: boolean; onClick: () => void }) {
	const accent = ACCENTS.orange;
	return (
		<textbutton
			Text=""
			AutoButtonColor={false}
			BackgroundColor3={props.held ? COLORS.woodLight : COLORS.woodDark}
			BackgroundTransparency={GLASS_TRANSPARENCY}
			Size={UDim2.fromOffset(slotSize(), slotSize())}
			LayoutOrder={props.index}
			Event={{ Activated: props.onClick }}
		>
			<uicorner CornerRadius={RADIUS.medium} />
			<uistroke
				Color={props.chosen ? accent : COLORS.outline}
				Thickness={props.chosen ? STROKE.heavy + 0.5 : STROKE.thin}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>
			<PickaxeModel tool={props.def.tool} />
			{props.index < KEYS.size() && (
				<textlabel
					BackgroundTransparency={1}
					Position={UDim2.fromOffset(5, 2)}
					Size={UDim2.fromOffset(16, 16)}
					Font={FONTS.display}
					Text={`${(props.index + 1) % 10}`}
					TextSize={TEXT_SIZES.small}
					TextColor3={props.chosen ? accent : COLORS.textMuted}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={2}
				>
					<uistroke Color={COLORS.outline} Thickness={1.5} />
				</textlabel>
			)}
		</textbutton>
	);
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
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -BOTTOM_OFFSET)}
			Size={UDim2.fromOffset(0, slotSize() + 26)}
			AutomaticSize={Enum.AutomaticSize.X}
			BackgroundTransparency={1}
		>
			{chosen !== undefined && (
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(1, 0, 0, 22)}
					Font={FONTS.display}
					Text={t(nameKeys.gear(chosen.id))}
					TextSize={TEXT_SIZES.body}
					TextColor3={held === chosen.id ? COLORS.white : COLORS.textMuted}
				>
					<uistroke Color={COLORS.outline} Thickness={2} />
				</textlabel>
			)}
			<frame
				BackgroundTransparency={1}
				Position={UDim2.fromOffset(0, 26)}
				Size={UDim2.fromOffset(0, slotSize())}
				AutomaticSize={Enum.AutomaticSize.X}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					Padding={new UDim(0, GAP)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{owned.map((def, index) => (
					<Slot
						key={def.id}
						def={def}
						index={index}
						chosen={def.id === equipped}
						held={def.id === held}
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
