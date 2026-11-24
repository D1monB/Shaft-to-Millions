// Boards floating above every machine in the world: what it is doing and how long until it is ready,
// so the player sees the factory working without opening panels. Purely visual, local to this player.
import React from "@rbxts/react";
import { createPortal } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { MACHINES, MachineId, isMachineId } from "shared/config/machines";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { machineProgress, storageTotal } from "shared/features/factory";
import { PlayerView } from "shared/features/profile";
import { formatDuration, formatMoney } from "shared/lib/format";
import { useView } from "client/features/profile";
import { useServerClock, useTagged } from "client/lib/hooks";
import { COLORS, FONTS, ProgressBar, RADIUS, STROKE, TEXT_SIZES } from "client/lib/ui-kit";
import { liveState } from "./factory-panels";

/** The part a board hangs over, and how high above it. Models use their bounding box. */
function anchorOf(instance: Instance): [BasePart, number] | undefined {
	if (instance.IsA("BasePart")) {
		return [instance, instance.Size.Y / 2];
	}
	if (instance.IsA("Model")) {
		const part = instance.PrimaryPart ?? instance.FindFirstChildWhichIsA("BasePart", true);
		if (part !== undefined) {
			// Offset from the anchor part's centre to the top of the whole model.
			const [cframe, size] = instance.GetBoundingBox();
			return [part, cframe.Position.Y + size.Y / 2 - part.Position.Y];
		}
	}
	return undefined;
}

interface BoardInfo {
	readonly title: string;
	readonly status: string;
	readonly tone: Color3;
	readonly progress?: number;
}

function boardInfo(machineId: MachineId, view: PlayerView, now: number): BoardInfo {
	const def = MACHINES[machineId];
	const saved = view.machines[machineId];
	if (saved === undefined) {
		return { title: def.name, status: `🔒 ${formatMoney(def.price)}`, tone: COLORS.textMuted };
	}
	const state = liveState(saved, now);
	const progress = machineProgress(state, now);
	const ready = storageTotal(state.ready);
	if (progress.current !== undefined) {
		return {
			title: def.name,
			status: `⏱ ${formatDuration(progress.secondsLeft)} · черга ${state.queue.size()}${ready > 0 ? ` · ✅ ${ready}` : ""}`,
			tone: COLORS.text,
			progress: progress.fraction,
		};
	}
	if (ready > 0) {
		return { title: def.name, status: `✅ Готово: ${ready}`, tone: COLORS.success };
	}
	return { title: def.name, status: "💤 Простоює", tone: COLORS.textMuted };
}

function Board(props: { part: BasePart; height: number; info: BoardInfo }) {
	return (
		<billboardgui
			Adornee={props.part}
			Size={new UDim2(0, 200, 0, 70)}
			StudsOffsetWorldSpace={new Vector3(0, props.height + 2.5, 0)}
			MaxDistance={70}
			AlwaysOnTop={false}
			LightInfluence={0}
			ResetOnSpawn={false}
		>
			<frame Size={new UDim2(1, 0, 1, 0)} BackgroundColor3={COLORS.woodDark} BackgroundTransparency={0.1}>
				<uicorner CornerRadius={RADIUS.medium} />
				<uistroke Color={COLORS.outline} Thickness={STROKE.thick} />
				<uipadding
					PaddingTop={new UDim(0, 4)}
					PaddingBottom={new UDim(0, 6)}
					PaddingLeft={new UDim(0, 8)}
					PaddingRight={new UDim(0, 8)}
				/>
				<uilistlayout Padding={new UDim(0, 2)} SortOrder={Enum.SortOrder.LayoutOrder} />
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(1, 0, 0, 22)}
					Font={FONTS.display}
					Text={props.info.title}
					TextSize={TEXT_SIZES.body + 1}
					TextColor3={COLORS.gold}
					LayoutOrder={1}
				>
					<uistroke Color={COLORS.outline} Thickness={1.5} />
				</textlabel>
				<textlabel
					BackgroundTransparency={1}
					Size={new UDim2(1, 0, 0, 18)}
					Font={FONTS.display}
					Text={props.info.status}
					TextSize={TEXT_SIZES.small}
					TextColor3={props.info.tone}
					LayoutOrder={2}
				/>
				{props.info.progress !== undefined && (
					<ProgressBar progress={props.info.progress} height={10} order={3} />
				)}
			</frame>
		</billboardgui>
	);
}

/** Rendered once by the app; finds machines by tag (they stream in and out with StreamingEnabled). */
export function MachineBoards() {
	const view = useView();
	const now = useServerClock(1);
	const machines = useTagged(TAGS.Machine);
	if (view === undefined) {
		return undefined;
	}
	const boards: React.Element[] = [];
	machines.forEach((instance, index) => {
		const machineId = instance.GetAttribute(ATTRIBUTES.MachineId);
		const anchor = anchorOf(instance);
		if (isMachineId(machineId) && anchor !== undefined) {
			boards.push(
				<Board
					key={`board_${machineId}_${index}`}
					part={anchor[0]}
					height={anchor[1]}
					info={boardInfo(machineId, view, now)}
				/>,
			);
		}
	});
	// Billboards must live under PlayerGui (not inside a ScreenGui) to be drawn in the world.
	return createPortal(<>{boards}</>, Players.LocalPlayer.WaitForChild("PlayerGui"));
}
