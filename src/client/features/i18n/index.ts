// i18n feature (client): picks the language, rewrites world texts, and the language switch in the menu.
// Public API of this feature. Other code imports only from this file.
import { startLanguageController } from "./language-controller";
import { startLanguagePanel } from "./language-panel";
import { startWorldTexts } from "./world-texts";

export function startI18nController(): void {
	startLanguageController();
	startWorldTexts();
	startLanguagePanel();
}
