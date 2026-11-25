// "What next" hint: one clear goal on a sign at the bottom of the screen.
// Features register where goals come from; the shared pickGoal chooses exactly one.
import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import { BAGS } from "shared/config/bags";
import { MACHINE_IDS } from "shared/config/machines";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import { bagCapacity, bagTotal } from "shared/features/bag";
import { GoalCandidate, pickGoal } from "shared/features/goals";
import { PlayerView } from "shared/features/profile";
import { useView } from "client/features/profile";
import { COLORS, FONTS, RADIUS, STROKE, TEXT_SIZES } from "client/lib/ui-kit";

const sources: Array<(view: PlayerView) => GoalCandidate[]> = [];

/** Adds a source of goals, e.g. "buy the furnace". */
export function registerGoalSource(source: (view: PlayerView) => GoalCandidate[]): void {
	sources.push(source);
}

function gearGoals(view: PlayerView): GoalCandidate[] {
	const goals: GoalCandidate[] = [];
	const current = PICKAXES[view.levels.pickaxe - 1];
	const nextPickaxe = PICKAXES[view.levels.pickaxe];
	if (current !== undefined && nextPickaxe !== undefined) {
		const unlocksOre = ORE_IDS.some(
			(id) => ORES[id].requiredTier > current.tier && ORES[id].requiredTier <= nextPickaxe.tier,
		);
		goals.push({ label: nextPickaxe.name, price: nextPickaxe.price, priority: unlocksOre ? 0 : 2 });
	}
	const nextBag = BAGS[view.levels.bag];
	if (nextBag !== undefined) {
		goals.push({ label: nextBag.name, price: nextBag.price, priority: 1 });
	}
	// Shoes only shorten trips, so they are hinted after the first machine. Earlier, the cheapest-goal rule would make
	// the $120 shoes the first target of a new player instead of the bag and the first pickaxe.
	const nextShoes = SHOES[view.levels.shoes];
	const ownsMachine = MACHINE_IDS.some((id) => view.machines[id] !== undefined);
	if (nextShoes !== undefined && ownsMachine) {
		goals.push({ label: nextShoes.name, price: nextShoes.price, priority: 2 });
	}
	return goals;
}

function currentGoal(view: PlayerView): string {
	const candidates: GoalCandidate[] = [];
	for (const source of sources) {
		for (const goal of source(view)) {
			candidates.push(goal);
		}
	}
	return pickGoal(
		{ money: view.money, bagUsed: bagTotal(view.bag), bagCapacity: bagCapacity(view.levels.bag) },
		candidates,
	);
}

export function startGoalsController(): void {
	registerGoalSource(gearGoals);
}

/** The sign at the bottom centre. It bounces once whenever the goal text changes, to catch the eye. */
export function GoalBanner() {
	const view = useView();
	const text = view === undefined ? undefined : currentGoal(view);
	const [scale, scaleMotion] = useMotion(1);
	useEffect(() => {
		if (text !== undefined) {
			scaleMotion.set(1.15);
			scaleMotion.spring(1, { tension: 300, friction: 12 });
		}
	}, [text, scaleMotion]);

	if (text === undefined) {
		return undefined;
	}
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -18)}
			Size={new UDim2(0, 0, 0, 56)}
			AutomaticSize={Enum.AutomaticSize.X}
			BackgroundColor3={COLORS.woodDark}
			BackgroundTransparency={0.05}
		>
			<uiscale Scale={scale} />
			<uisizeconstraint MaxSize={new Vector2(720, 56)} />
			<uicorner CornerRadius={RADIUS.round} />
			<uistroke Color={COLORS.gold} Thickness={STROKE.thick} />
			<uipadding PaddingLeft={new UDim(0, 18)} PaddingRight={new UDim(0, 20)} />
			<textlabel
				BackgroundTransparency={1}
				Size={new UDim2(0, 0, 1, 0)}
				AutomaticSize={Enum.AutomaticSize.X}
				Font={FONTS.display}
				Text={`🎯  ${text}`}
				TextSize={TEXT_SIZES.large}
				TextColor3={COLORS.gold}
				TextTruncate={Enum.TextTruncate.AtEnd}
			>
				<uistroke Color={COLORS.outline} Thickness={2} />
			</textlabel>
		</frame>
	);
}
