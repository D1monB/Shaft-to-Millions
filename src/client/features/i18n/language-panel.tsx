// The language switch in the menu (decision 033): "Automatic" plus each of our languages, written in itself.
import React from "@rbxts/react";
import { AUTO_LANGUAGE, LANGUAGES, LANGUAGE_NAMES } from "shared/features/i18n";
import { registerHudButton } from "client/features/hud";
import { onLanguageChanged, t, useLanguageChoice } from "client/lib/i18n";
import { isPanelOpen, openPanel } from "client/lib/panels";
import { Button, Label } from "client/lib/ui-kit";
import { chooseLanguage, getSavedLanguage } from "./language-controller";

const PANEL_KEY = "language";

function LanguagePanel() {
	// Re-renders on a change, so the ✅ follows the choice.
	useLanguageChoice();
	const saved = getSavedLanguage();
	return (
		<>
			<Label text={t("language.autoHint")} tone="muted" order={1} />
			<Button
				text={`${saved === AUTO_LANGUAGE ? "✅ " : ""}${t("language.auto")}`}
				variant={saved === AUTO_LANGUAGE ? "primary" : "secondary"}
				onClick={() => chooseLanguage(AUTO_LANGUAGE)}
				order={2}
			/>
			{LANGUAGES.map((language, index) => (
				<Button
					key={language}
					text={`${saved === language ? "✅ " : ""}${LANGUAGE_NAMES[language]}`}
					variant={saved === language ? "primary" : "secondary"}
					onClick={() => chooseLanguage(language)}
					order={index + 3}
				/>
			))}
		</>
	);
}

function openLanguagePanel(): void {
	openPanel({ key: PANEL_KEY, title: t("language.title"), icon: "🌐", render: () => <LanguagePanel /> });
}

export function startLanguagePanel(): void {
	registerHudButton("🌐", () => t("language.title"), openLanguagePanel, 90, "secondary", true);
	// The open panel's title was written in the old language: open it again in the new one.
	onLanguageChanged(() => {
		if (isPanelOpen(PANEL_KEY)) {
			openLanguagePanel();
		}
	});
}
