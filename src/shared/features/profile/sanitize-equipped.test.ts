import { Assert, Test } from "@rbxts/lunit";
import { PlainTable } from "shared/lib/tables";
import { loadProfileData } from "./load-profile-data";
import { createDefaultProfileData } from "./schema";

function load(mutate: (raw: PlainTable) => void) {
	const raw = createDefaultProfileData() as unknown as PlainTable;
	mutate(raw);
	const result = loadProfileData(raw);
	if (!result.ok) {
		Assert.fail(`load failed: ${result.reason}`);
	}
	return result;
}

const INVENTORY = [
	{ uid: "i1", item: "pet_mole" },
	{ uid: "i2", item: "pet_golem" },
	{ uid: "i3", item: "aura_storm" },
	{ uid: "i4", item: "paura_core" },
	{ uid: "i5", item: "pet_beetle" },
	{ uid: "i6", item: "pet_moth" },
];

class SanitizeEquippedTests {
	@Test
	public keepsAValidLoadout() {
		const result = load((raw) => {
			raw.inventory = INVENTORY;
			raw.nextUid = 7;
			raw.equipped = { speedAura: "i3", pickaxeAura: "i4", pets: ["i1", "i2"] };
		});
		Assert.equal(result.data.equipped.speedAura, "i3");
		Assert.equal(result.data.equipped.pets.size(), 2);
		Assert.equal(result.repairs.size(), 0);
	}

	@Test
	public dropsItemsInTheWrongSlot() {
		const result = load((raw) => {
			raw.inventory = INVENTORY;
			raw.equipped = { speedAura: "i2", pickaxeAura: "i3", pets: ["i4"] };
		});
		Assert.undefined(result.data.equipped.speedAura);
		Assert.undefined(result.data.equipped.pickaxeAura);
		Assert.equal(result.data.equipped.pets.size(), 0);
	}

	@Test
	public dropsUnownedDuplicateAndExtraPets() {
		const result = load((raw) => {
			raw.inventory = INVENTORY;
			raw.equipped = { pets: ["i2", "i2", "i99", "i1", "i5", "i6"] };
		});
		const pets = result.data.equipped.pets;
		Assert.equal(pets.size(), 3);
		Assert.equal(pets[0], "i2");
		Assert.equal(pets[1], "i1");
		Assert.equal(pets[2], "i5");
	}

	@Test
	public brokenEquippedTableIsReset() {
		const result = load((raw) => {
			raw.equipped = "all";
		});
		Assert.equal(result.data.equipped.pets.size(), 0);
	}
}

export = SanitizeEquippedTests;
