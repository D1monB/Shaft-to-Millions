// World texts built by the server for everyone (ProximityPrompts, sign labels) carry their text as attributes; this
// rewrites them locally in the player's language (decision 033). The change stays on this client only.
import { CollectionService, HttpService } from "@rbxts/services";
import { I18N_ATTRIBUTES, LOCALIZED_TAG, Text, decodeText } from "shared/features/i18n";
import { getLanguageChoice, onLanguageChanged, tx } from "client/lib/i18n";

function read(instance: Instance, attribute: string): Text | undefined {
	const raw = instance.GetAttribute(attribute);
	if (!typeIs(raw, "string")) {
		return undefined;
	}
	const [ok, decoded] = pcall(() => HttpService.JSONDecode(raw));
	if (!ok || !typeIs(decoded, "table")) {
		return undefined;
	}
	const value = decoded as { k?: unknown; p?: unknown };
	return decodeText(value.k, value.p);
}

function apply(instance: Instance): void {
	// Same rule as the UI: Roblox may auto-translate only the English shown for languages we do not have.
	const autoLocalize = getLanguageChoice().robloxTranslates;
	if (instance.IsA("ProximityPrompt")) {
		instance.AutoLocalize = autoLocalize;
		const action = read(instance, I18N_ATTRIBUTES.Action);
		const object = read(instance, I18N_ATTRIBUTES.Object);
		if (action !== undefined) {
			instance.ActionText = tx(action);
		}
		if (object !== undefined) {
			instance.ObjectText = tx(object);
		}
	} else if (instance.IsA("TextLabel") || instance.IsA("TextButton")) {
		instance.AutoLocalize = autoLocalize;
		const value = read(instance, I18N_ATTRIBUTES.Text);
		if (value !== undefined) {
			instance.Text = tx(value);
		}
	}
}

function applyAll(): void {
	for (const instance of CollectionService.GetTagged(LOCALIZED_TAG)) {
		apply(instance);
	}
}

export function startWorldTexts(): void {
	// With streaming, tagged texts arrive (and leave) as the player moves: each one is rewritten when it appears.
	CollectionService.GetInstanceAddedSignal(LOCALIZED_TAG).Connect(apply);
	applyAll();
	onLanguageChanged(applyAll);
}
