// progress feature (client): the newcomer guide, calendar, rebirth, titles, friend and live-event tiles, and the
// invite button (decision 070). Public API of this feature. Other code imports only from this file.
import React from "@rbxts/react";
import { Players, SocialService, Workspace } from "@rbxts/services";
import { StringKey } from "shared/config/i18n";
import { PlayerView } from "shared/features/profile";
import { FRIEND_BONUS_ATTRIBUTE, canClaimCalendar, menuUnlocked, tutorialStatsOf } from "shared/features/progress";
import { dayOf } from "shared/features/quests";
import { formatPercent } from "shared/lib/format";
import { refreshHud, registerHudButton, registerHudStat, setMenuGate } from "client/features/hud";
import { t } from "client/lib/i18n";
import { openPanel } from "client/lib/panels";
import { startGuideArrow } from "./guide";
import { startOverheadTitles } from "./overhead-titles";
import { CalendarPanel, RebirthPanel, TitlesPanel } from "./panels";

export { GuideCard } from "./guide";

/** The Workspace attribute the server publishes the running live event in. */
const LIVE_EVENT_ATTRIBUTE = "LiveEvent";

function invite(): void {
	const player = Players.LocalPlayer;
	task.spawn(() => {
		const [ok, allowed] = pcall(() => SocialService.CanSendGameInviteAsync(player));
		if (ok && allowed === true) {
			pcall(() => SocialService.PromptGameInvite(player));
		}
	});
}

function panelButton(icon: string, key: string, title: StringKey, order: number, render: () => React.Element): void {
	registerHudButton(
		icon,
		() => t(title),
		() => openPanel({ key, title: t(title), icon, render }),
		order,
		"primary",
		true,
	);
}

export function startProgressController(): void {
	startGuideArrow();
	startOverheadTitles();
	panelButton("📅", "calendar", "menu.calendar", 3, () => <CalendarPanel />);
	panelButton("🏅", "titles", "menu.titles", 12, () => <TitlesPanel />);
	panelButton("🌟", "rebirth", "menu.rebirth", 13, () => <RebirthPanel />);
	registerHudButton("👥", () => t("menu.invite"), invite, 14, "success", true);

	// New players meet the base, the aura machine and the raid one by one.
	setMenuGate((menu: "base" | "aura" | "raid", view: PlayerView) =>
		menuUnlocked(menu, tutorialStatsOf(view, false), view.guideClosed),
	);

	registerHudStat(2, (view) =>
		canClaimCalendar(view.calendar, dayOf(os.time()))
			? { icon: "📅", text: t("calendar.ready"), short: "!", tone: "gold" }
			: undefined,
	);
	registerHudStat(7, () => {
		const bonus = Players.LocalPlayer.GetAttribute(FRIEND_BONUS_ATTRIBUTE);
		return typeIs(bonus, "number") && bonus > 0
			? {
					icon: "👥",
					text: t("friends.tile", { value: formatPercent(bonus) }),
					short: formatPercent(bonus),
					tone: "success",
				}
			: undefined;
	});
	registerHudStat(8, () => {
		const event = Workspace.GetAttribute(LIVE_EVENT_ATTRIBUTE);
		return typeIs(event, "string") && event !== ""
			? { icon: "🎉", text: t(`live.${event}` as StringKey), short: "🎉", tone: "gold" }
			: undefined;
	});
	Players.LocalPlayer.GetAttributeChangedSignal(FRIEND_BONUS_ATTRIBUTE).Connect(refreshHud);
	Workspace.GetAttributeChangedSignal(LIVE_EVENT_ATTRIBUTE).Connect(refreshHud);
}
