import { Assert, Test } from "@rbxts/lunit";
import { BAGS } from "shared/config/bags";
import { CHEST_IDS } from "shared/config/chests";
import { DRILLS } from "shared/config/drills";
import { ITEMS } from "shared/config/items";
import { LAYER_COUNT } from "shared/config/layers";
import { LINE_MACHINES } from "shared/config/line";
import { ORE_IDS } from "shared/config/ores";
import { PICKAXES } from "shared/config/pickaxes";
import { SHOES } from "shared/config/shoes";
import { nameKeys } from "./names";
import { isStringKey } from "./translate";

function expectKey(key: string): void {
	Assert.true(isStringKey(key), `no text for ${key}`);
}

// Every piece of content in the configs must have a name in the texts (decision 033): a new ore or machine without
// one would show its raw key on screen.
class NamesTests {
	@Test
	public everyConfigIdHasAName() {
		for (const id of ORE_IDS) {
			expectKey(nameKeys.ore(id));
		}
		for (let layer = 1; layer <= LAYER_COUNT; layer++) {
			expectKey(nameKeys.layer(layer));
			expectKey(nameKeys.layerMood(layer));
			if (DRILLS[layer] !== undefined) {
				expectKey(nameKeys.drill(layer));
			}
		}
		for (const machine of LINE_MACHINES) {
			expectKey(nameKeys.machine(machine.id));
			expectKey(nameKeys.machineOutput(machine.id));
		}
		for (const gear of [...PICKAXES, ...BAGS, ...SHOES]) {
			expectKey(nameKeys.gear(gear.id));
			if (gear.special !== undefined) {
				expectKey(nameKeys.gearSpecial(gear.id));
			}
		}
		for (const id of CHEST_IDS) {
			expectKey(nameKeys.chest(id));
			expectKey(nameKeys.chestDescription(id));
		}
		for (const [id, item] of pairs(ITEMS)) {
			expectKey(nameKeys.item(id));
			expectKey(nameKeys.rarity(item.rarity));
			expectKey(nameKeys.kind(item.kind));
		}
	}
}

export = NamesTests;
