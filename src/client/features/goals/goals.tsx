// "What next" hint: one clear goal in a capsule at the bottom of the screen, with a bar that fills as money comes in.
// Features register where goals come from; the shared pickGoalInfo chooses exactly one.
import { nameKeys } from "shared/features/i18n";
import { t, tx } from "client/lib/i18n";
import { useMotion } from "@rbxts/pretty-react-hooks";
import React, { useEffect } from "@rbxts/react";
import { ORES, ORE_IDS } from "shared/config/ores";
import { PickaxeDef } from "shared/config/pickaxes";
import { bagCapacity, bagTotal } from "shared/features/bag";
import { baseEffects } from "shared/features/base";
import { GoalCandidate, GoalInfo, pickGoalInfo } from "shared/features/goals";
import { getPickaxe } from "shared/features/mining";
import { GearSlot, nextGearToBuy } from "shared/features/upgrades";
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

/** The next main-line item of a slot as a goal. */
function gearGoal(view: PlayerView, slot: GearSlot, priority: number): GoalCandidate | undefined {
	const upcoming = nextGearToBuy(slot, view.gear, getPickaxe(view.gear.equipped.pickaxe).tier);
	if (upcoming === undefined) {
		return undefined;
	}
	return { label: nameKeys.gear(upcoming.id), price: upcoming.price, priority };
}

function gearGoals(view: PlayerView): GoalCandidate[] {
	const goals: GoalCandidate[] = [];
	const current = getPickaxe(view.gear.equipped.pickaxe);
	const upcoming = nextGearToBuy("pickaxe", view.gear, current.tier) as PickaxeDef | undefined;
	const unlocksOre =
		upcoming !== undefined &&
		ORE_IDS.some((id) => ORES[id].requiredTier > current.tier && ORES[id].requiredTier <= upcoming.tier);
	const pickaxe = gearGoal(view, "pickaxe", unlocksOre ? 0 : 2);
	const bag = gearGoal(view, "bag", 1);
	// Shoes only shorten trips, so they are hinted after the first line machine. Earlier, the cheapest-goal rule would make
	// the cheap shoes the first target of a new player instead of the bag and the first pickaxe.
	const ownsMachine = view.line.machines.size() > 0;
	const shoes = ownsMachine ? gearGoal(view, "shoes", 2) : undefined;
	for (const goal of [pickaxe, bag, shoes]) {
		if (goal !== undefined) {
			goals.push(goal);
		}
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
		{
			money: view.money,
			bagUsed: bagTotal(view.bag),
			bagCapacity: bagCapacity(view.gear.equipped.bag, baseEffects(view.base).bagBonus),
		},
		candidates,
	);
}

export function startGoalsController(): void {
	registerGoalSource(gearGoals);
}

const BANNER_WIDTH = 360;
const BANNER_HEIGHT = 42;
const BADGE_ROOM = 42;

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

/**
 * The goal capsule at the top centre (it covered the pickaxe hotbar at the bottom, feedback 2026-11-26). It bounces
 * once whenever the goal changes, to catch the eye.
 */
export function GoalBanner() {
	const view = useView();
	const info = view === undefined ? undefined : currentGoal(view);
	// The words, not the object: a new object arrives on every render, the words change only with the goal.
	const key = info !== undefined ? tx(info.text) : undefined;
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
	const name = escapeRich(tx(info.title));
	const title = isPurchase ? t("goal.banner", { name: `<font color="#FCD34D">${name}</font>` }) : name;
	return (
		<frame
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, 12)}
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
				<CapsuleBadge icon="🎯" ramp={RAMPS.close} size={36} round={true} />
				<frame
					BackgroundTransparency={1}
					Position={new UDim2(0, BADGE_ROOM, 0, 5)}
					Size={new UDim2(1, -(BADGE_ROOM + 16), 1, -10)}
				>
					<textlabel
						BackgroundTransparency={1}
						Size={new UDim2(0.62, 0, 0, 20)}
						Font={FONTS.display}
						RichText={true}
						Text={title}
						TextSize={TEXT_SIZES.small + 1}
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
						Size={new UDim2(0.38, 0, 0, 20)}
						Font={FONTS.display}
						Text={tx(info.status)}
						TextSize={TEXT_SIZES.small}
						TextColor3={statusColor(info)}
						TextXAlignment={Enum.TextXAlignment.Right}
						TextTruncate={Enum.TextTruncate.AtEnd}
					>
						<uistroke Color={COLORS.outline} Thickness={2} />
					</textlabel>
					<frame BackgroundTransparency={1} Position={new UDim2(0, 0, 1, -10)} Size={new UDim2(1, 0, 0, 10)}>
						<ProgressBar
							progress={info.progress}
							color={info.kind === "bag-full" ? COLORS.canyon : COLORS.success}
							height={10}
						/>
					</frame>
				</frame>
			</frame>
		</frame>
	);
}
