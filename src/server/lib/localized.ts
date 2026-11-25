// World texts that every client shows in its own language (decision 033). The server writes English (the source
// language, which Roblox may auto-translate for other languages) plus the text as an attribute; the client's i18n
// feature rewrites the visible text locally.
import { CollectionService, HttpService } from "@rbxts/services";
import { I18N_ATTRIBUTES, LOCALIZED_TAG, SOURCE_LANGUAGE, Text, translateText } from "shared/features/i18n";

function encode(value: Text): string {
	return HttpService.JSONEncode({ k: value.key, p: value.params });
}

export function localizePrompt(prompt: ProximityPrompt, action: Text, object?: Text): void {
	prompt.ActionText = translateText(SOURCE_LANGUAGE, action);
	prompt.SetAttribute(I18N_ATTRIBUTES.Action, encode(action));
	if (object !== undefined) {
		prompt.ObjectText = translateText(SOURCE_LANGUAGE, object);
		prompt.SetAttribute(I18N_ATTRIBUTES.Object, encode(object));
	}
	CollectionService.AddTag(prompt, LOCALIZED_TAG);
}

export function localizeLabel(label: TextLabel | TextButton, value: Text): void {
	label.Text = translateText(SOURCE_LANGUAGE, value);
	label.SetAttribute(I18N_ATTRIBUTES.Text, encode(value));
	CollectionService.AddTag(label, LOCALIZED_TAG);
}
