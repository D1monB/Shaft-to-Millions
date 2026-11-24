// Routes ProximityPrompt presses to features by the CollectionService tag of the object the prompt sits on.
// The server only adds prompts; what the press opens on screen is decided here, on the client.
import { CollectionService, ProximityPromptService } from "@rbxts/services";

const handlers = new Map<string, (tagged: Instance) => void>();

function findTaggedAncestor(start: Instance): [string, Instance] | undefined {
	let node: Instance | undefined = start;
	while (node !== undefined) {
		for (const tag of CollectionService.GetTags(node)) {
			if (handlers.has(tag)) {
				return [tag, node];
			}
		}
		node = node.Parent;
	}
	return undefined;
}

let started = false;

/** Calls `handler` when the local player presses a prompt on (or inside) an object with this tag. */
export function onPromptForTag(tag: string, handler: (tagged: Instance) => void): void {
	handlers.set(tag, handler);
	if (started) {
		return;
	}
	started = true;
	ProximityPromptService.PromptTriggered.Connect((prompt) => {
		const found = findTaggedAncestor(prompt);
		if (found !== undefined) {
			handlers.get(found[0])?.(found[1]);
		}
	});
}
