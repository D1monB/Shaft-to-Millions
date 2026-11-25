// Keys of the names of game content, built from config ids (decision 033): a new ore or machine needs only its id
// in the config and its name in each language file (a test checks that every id has one).
import { StringKey } from "shared/config/i18n";

export const nameKeys = {
	ore: (id: string) => `ore.${id}` as StringKey,
	layer: (layer: number) => `layer.${layer}` as StringKey,
	layerMood: (layer: number) => `layer.${layer}.mood` as StringKey,
	machine: (id: string) => `machine.${id}` as StringKey,
	machineOutput: (id: string) => `machine.${id}.output` as StringKey,
	gear: (id: string) => `gear.${id}` as StringKey,
	gearSpecial: (id: string) => `gear.${id}.special` as StringKey,
	drill: (layer: number) => `drill.${layer}` as StringKey,
	chest: (id: string) => `chest.${id}` as StringKey,
	chestDescription: (id: string) => `chest.${id}.desc` as StringKey,
	item: (id: string) => `item.${id}` as StringKey,
	rarity: (id: string) => `rarity.${id}` as StringKey,
	kind: (id: string) => `kind.${id}` as StringKey,
} as const;
