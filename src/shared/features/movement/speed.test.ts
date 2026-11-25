import { Assert, Test } from "@rbxts/lunit";
import { MAX_WALK_SPEED, SHOES } from "shared/config/shoes";
import { shoesFor, walkSpeedFor } from "./speed";

class SpeedTests {
	@Test
	public shoesGetFasterAndStartAtRobloxDefault() {
		Assert.equal(SHOES[0].walkSpeed, 16);
		Assert.equal(SHOES[0].price, 0);
		for (let i = 1; i < SHOES.size(); i++) {
			Assert.true(SHOES[i].walkSpeed > SHOES[i - 1].walkSpeed);
			Assert.true(SHOES[i].price > SHOES[i - 1].price);
		}
	}

	@Test
	public auraMultiplies() {
		Assert.equal(walkSpeedFor(SHOES[0].id, 0), 16);
		Assert.equal(walkSpeedFor(SHOES[0].id, 0.25), 20);
	}

	@Test
	public speedIsCapped() {
		Assert.equal(walkSpeedFor(SHOES[SHOES.size() - 1].id, 10), MAX_WALK_SPEED);
		Assert.equal(walkSpeedFor(SHOES[0].id, math.huge), MAX_WALK_SPEED);
	}

	@Test
	public badInputFallsBackSafely() {
		Assert.equal(walkSpeedFor("", 0 / 0), 16);
		Assert.equal(walkSpeedFor("bag_sack", -1), 16);
		Assert.equal(shoesFor(SHOES[2].id), SHOES[2]);
	}
}

export = SpeedTests;
