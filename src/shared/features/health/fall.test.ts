import { Assert, Test } from "@rbxts/lunit";
import { FallState, fallDamage, stepFall } from "./fall";
import { FALL_MAX_DAMAGE, FALL_SAFE_HEIGHT } from "./tuning";

class FallTests {
	@Test
	public smallDropsAreFree() {
		Assert.equal(fallDamage(0), 0);
		Assert.equal(fallDamage(FALL_SAFE_HEIGHT), 0);
		Assert.true(fallDamage(FALL_SAFE_HEIGHT + 10) > 0);
		Assert.equal(fallDamage(10_000), FALL_MAX_DAMAGE);
		for (const bad of [0 / 0, -5, math.huge, -math.huge]) {
			Assert.equal(fallDamage(bad), 0, `drop ${bad}`);
		}
	}

	@Test
	public landingHurtsOnce() {
		const state: FallState = {};
		stepFall(state, 100, true);
		stepFall(state, 90, false);
		stepFall(state, 70, false);
		stepFall(state, 55, false);
		Assert.true(stepFall(state, 50, true) > 0);
		Assert.equal(stepFall(state, 50, true), 0);
	}

	@Test
	public teleportsAndJunkNeverHurt() {
		const state: FallState = {};
		stepFall(state, 500, false);
		Assert.equal(stepFall(state, 0, true), 0);
		Assert.equal(stepFall(state, 0 / 0, false), 0);
		Assert.equal(stepFall(state, 0, true), 0);
	}
}

export = FallTests;
