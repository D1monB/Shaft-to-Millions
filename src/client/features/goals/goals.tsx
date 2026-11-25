// "What next" hint: one clear goal in a capsule at the bottom of the screen, with a bar that fills as money comes in.
// Features register where goals come from; the shared pickGoalInfo chooses exactly one.
import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import { BAGS } from "shared/config/bags";
import { MACHINE_IDS } from "shared/config/machines";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import { bagCapacity, bagTotal } from "shared/features/bag";
import { GoalCandidate, GoalInfo, pickGoalInfo } from "shared/features/goals";
import { PlayerView } from "shared/features/profile";
import { useView } from "client/features/profile";
import {
	COLORS,
	CapsuleBadge,
	DEPTH,
	FONTS,
	ProgressBar,
	RADIUS,
	RAMPS,
	STROKE,
	TEXT_SIZES,
	rampSequence,
} from "client/lib/ui-kit";

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

function currentGoal(view: PlayerView): GoalInfo {
	const candidates: GoalCandidate[] = [];
	for (const source of sources) {
		for (const goal of source(view)) {
			candidates.push(goal);
		}
	}
	return pickGoalInfo(
		{ money: view.money, bagUsed: bagTotal(view.bag), bagCapacity: bagCapacity(view.levels.bag) },
		candidates,
	);
}

export function startGoalsController(): void {
	registerGoalSource(gearGoals);
}

const BANNER_WIDTH = 480;
const BANNER_HEIGHT = 70;
const BADGE_ROOM = 60;

/** Escapes text for RichText, so an item name can never break the markup. */
function escapeRich(text: string): string {
	return text.gsub("&", "&amp;")[0].gsub("<", "&lt;")[0].gsub(">", "&gt;")[0];
}

function statusColor(info: GoalInfo): Color3 {
	if (info.kind === "bag-full") {
		return COLORS.danger;
	}
	return info.kind === "affordable" ? COLORS.success : COLORS.gold;
}

/** The goal capsule at the bottom centre. It bounces once whenever the goal changes, to catch the eye. */
export function GoalBanner() {
	const view = useView();
	const info = view === undefined ? undefined : currentGoal(view);
	const key = info?.text;
	const [scale, scaleMotion] = useMotion(1);
	useEffect(() => {
		if (key !== undefined) {
			scaleMotion.set(1.12);
			scaleMotion.spring(1, { tension: 300, friction: 12 });
		}
	}, [key, scaleMotion]);

	if (info === undefined) {
		return undefined;
	}
	const isPurchase = info.kind === "saving" || info.kind === "affordable";
	const title = isPurchase ? `Ціль: <font color="#FCD34D">${escapeRich(info.title)}</font>` : escapeRich(info.title);
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -14)}
			Size={new UDim2(0, BANNER_WIDTH, 0, BANNER_HEIGHT + DEPTH.button)}
			BackgroundTransparency={1}
		>
			<uiscale Scale={scale} />
			<frame
				BackgroundColor3={COLORS.outline}
				BorderSizePixel={0}
				Position={new UDim2(0, 0, 0, DEPTH.button)}
				Size={new UDim2(1, 0, 0, BANNER_HEIGHT)}
			>
				<uicorner CornerRadius={RADIUS.round} />
			</frame>
			<frame BackgroundColor3={COLORS.white} BorderSizePixel={0} Size={new UDim2(1, 0, 0, BANNER_HEIGHT)}>
				<uicorner CornerRadius={RADIUS.round} />
				<uistroke Color={COLORS.gold} Thickness={STROKE.thick} />
				<uigradient Rotation={90} Color={rampSequence(RAMPS.capsule)} />
				<CapsuleBadge icon="🎯" ramp={RAMPS.close} size={52} round={true} />
				<frame
					BackgroundTransparency={1}
					Position={new UDim2(0, BADGE_ROOM, 0, 10)}
					Size={new UDim2(1, -(BADGE_ROOM + 24), 1, -20)}
				>
					<textlabel
						BackgroundTransparency={1}
						Size={new UDim2(0.62, 0, 0, 26)}
						Font={FONTS.display}
						RichText={true}
						Text={title}
						TextSize={TEXT_SIZES.body}
						TextColor3={COLORS.white}
						TextXAlignment={Enum.TextXAlignment.Left}
						TextTruncate={Enum.TextTruncate.AtEnd}
					>
						<uistroke Color={COLORS.outline} Thickness={2} />
					</textlabel>
					<textlabel
						AnchorPoint={new Vector2(1, 0)}
						BackgroundTransparency={1}
						Position={new UDim2(1, 0, 0, 0)}
						Size={new UDim2(0.38, 0, 0, 26)}
						Font={FONTS.display}
						Text={info.status}
						TextSize={TEXT_SIZES.body - 2}
						TextColor3={statusColor(info)}
						TextXAlignment={Enum.TextXAlignment.Right}
						TextTruncate={Enum.TextTruncate.AtEnd}
					>
						<uistroke Color={COLORS.outline} Thickness={2} />
					</textlabel>
					<frame BackgroundTransparency={1} Position={new UDim2(0, 0, 1, -16)} Size={new UDim2(1, 0, 0, 16)}>
						<ProgressBar
							progress={info.progress}
							color={info.kind === "bag-full" ? COLORS.canyon : COLORS.success}
							height={16}
						/>
					</frame>
				</frame>
			</frame>
		</frame>
	);
}
