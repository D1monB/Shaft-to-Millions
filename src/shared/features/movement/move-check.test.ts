import { Assert, Test } from "@rbxts/lunit";
import { MAX_WALK_SPEED } from "shared/config/shoes";
import { beginMoveState, checkMove, MoveSample, MoveState } from "./move-check";
import { ANCHOR_WINDOW, MAX_STRIKES, SLACK_STUDS, SPEED_TOLERANCE, STALL_SPAN, TELEPORT_STUDS } from "./tuning";

const SPEED = 16;

function at(x: number, time: number, y = 5, z = 0): MoveSample {
	return { x, y, z, time };
}

function start(): MoveState {
	const state = beginMoveState(at(0, 0));
	Assert.notUndefined(state);
	return state as MoveState; // asserted just above
}

class MoveCheckTests {
	@Test
	public honestWalkingIsOk() {
		let state = start();
		for (let i = 1; i <= 20; i++) {
			const result = checkMove(state, at(i * 0.25 * SPEED, i * 0.25), SPEED);
			Assert.equal(result.verdict, "ok");
			state = result.state;
		}
		Assert.equal(state.strikes, 0);
	}

	@Test
	public standingStillAndFallingAreOk() {
		const state = start();
		Assert.equal(checkMove(state, at(0, 0.25), SPEED).verdict, "ok");
		// Falling 100 studs in a quarter second (400 studs/s) is a normal fall in a deep shaft.
		Assert.equal(checkMove(state, at(0, 0.25, -95), SPEED).verdict, "ok");
		// A normal jump (about 7 studs up) is fine too.
		Assert.equal(checkMove(state, at(0, 0.25, 12), SPEED).verdict, "ok");
	}

	@Test
	public verticalTeleportsAreCaughtBothWays() {
		const state = start();
		Assert.equal(checkMove(state, at(0, 0.25, -2000), SPEED).verdict, "rubberband");
		Assert.equal(checkMove(state, at(0, 0.25, 200), SPEED).verdict, "rubberband");
	}

	@Test
	public flyingUpIsCaughtEvenThoughFallingIsAllowed() {
		// 200 studs/s upward is far above any jump; the same speed downward is a legal fall.
		const up = checkMove(start(), at(0, 1, 205), SPEED);
		Assert.notEqual(up.verdict, "ok");
		const down = checkMove(start(), at(0, 1, -195), SPEED);
		Assert.equal(down.verdict, "ok");
	}

	@Test
	public hackCombiningHorizontalAndVerticalIsCaught() {
		const result = checkMove(start(), { x: 300, y: -1000, z: 300, time: 0.25 }, SPEED);
		Assert.equal(result.verdict, "rubberband");
	}

	@Test
	public anchorMovesForwardOnlyAfterTheWindow() {
		const early = checkMove(start(), at(3, 0.25), SPEED);
		Assert.equal(early.verdict, "ok");
		Assert.equal(early.state.x, 0);
		Assert.equal(early.state.time, 0);

		const late = checkMove(start(), at(10, ANCHOR_WINDOW), SPEED);
		Assert.equal(late.verdict, "ok");
		Assert.equal(late.state.x, 10);
		Assert.equal(late.state.time, ANCHOR_WINDOW);
	}

	@Test
	public oneLagSpikeIsOnlyAStrikeAndIsForgiven() {
		const state = start();
		const allowance = SPEED * SPEED_TOLERANCE * 0.25 + SLACK_STUDS;
		const spike = checkMove(state, at(allowance + 5, 0.25), SPEED);
		Assert.equal(spike.verdict, "strike");
		Assert.equal(spike.state.x, 0); // honest position is kept
		Assert.equal(spike.state.strikes, 1);

		// The player catches up honestly: measured from the kept position over the longer span.
		const caughtUp = checkMove(spike.state, at(allowance + 5, 0.5), SPEED);
		Assert.equal(caughtUp.verdict, "ok");
		Assert.equal(caughtUp.state.strikes, 0);
	}

	@Test
	public teleportIsPulledBackAtOnce() {
		const result = checkMove(start(), at(500, 0.25), SPEED);
		Assert.equal(result.verdict, "rubberband");
		Assert.equal(result.state.x, 0);
		Assert.equal(result.state.strikes, 0);
	}

	@Test
	public justUnderTeleportDistanceIsOnlyAStrike() {
		const allowance = SPEED * SPEED_TOLERANCE * 0.25 + SLACK_STUDS;
		const result = checkMove(start(), at(allowance + TELEPORT_STUDS - 1, 0.25), SPEED);
		Assert.equal(result.verdict, "strike");
	}

	@Test
	public steadySpeedHackIsCaught() {
		// 3x speed: every sample is over the allowance, so strikes pile up until the pull-back.
		let state = start();
		let caught = false;
		for (let i = 1; i <= MAX_STRIKES + 2; i++) {
			const result = checkMove(state, at(i * 0.25 * SPEED * 3, i * 0.25), SPEED);
			state = result.state;
			if (result.verdict === "rubberband") {
				caught = true;
				break;
			}
		}
		Assert.true(caught);
	}

	@Test
	public speedFromAuraIsAllowedWhenTheServerSaysSo() {
		const fast = 30;
		const result = checkMove(start(), at(fast * 0.25, 0.25), fast);
		Assert.equal(result.verdict, "ok");
		// The same move is suspicious for a slow player.
		const slow = checkMove(start(), at(fast * 0.25 * 2, 0.25), SPEED);
		Assert.notEqual(slow.verdict, "ok");
	}

	@Test
	public stalledServerStartsOverInsteadOfPullingAnHonestPlayerBack() {
		const result = checkMove(start(), at(1000, STALL_SPAN + 1), SPEED);
		Assert.equal(result.verdict, "ok");
		Assert.equal(result.state.x, 1000);
		Assert.equal(result.state.strikes, 0);
	}

	@Test
	public justUnderTheStallSpanIsStillChecked() {
		const result = checkMove(start(), at(1000, STALL_SPAN - 0.1), SPEED);
		Assert.equal(result.verdict, "rubberband");
	}

	@Test
	public brokenWalkSpeedFallsBackToTheGlobalCap() {
		const span = 0.25;
		const cap = MAX_WALK_SPEED * SPEED_TOLERANCE * span + SLACK_STUDS;
		for (const bad of [0 / 0, math.huge, -5, 0]) {
			Assert.equal(checkMove(start(), at(cap - 1, span), bad).verdict, "ok");
			Assert.notEqual(checkMove(start(), at(cap + 5, span), bad).verdict, "ok");
		}
	}

	@Test
	public brokenSamplesArePulledBack() {
		const state = start();
		for (const bad of [0 / 0, math.huge, -math.huge]) {
			Assert.equal(checkMove(state, at(bad, 0.25), SPEED).verdict, "rubberband");
			Assert.equal(checkMove(state, at(0, 0.25, bad), SPEED).verdict, "rubberband");
			Assert.equal(checkMove(state, at(0, 0.25, 5, bad), SPEED).verdict, "rubberband");
			Assert.equal(checkMove(state, at(0, bad), SPEED).verdict, "rubberband");
		}
		// The pull-back target is still the last honest position.
		Assert.equal(checkMove(state, at(0 / 0, 0.25), SPEED).state.x, 0);
	}

	@Test
	public noTimeProgressChangesNothing() {
		const state = start();
		Assert.equal(checkMove(state, at(1000, 0), SPEED).verdict, "ok");
		Assert.equal(checkMove(state, at(1000, -1), SPEED).verdict, "ok");
		Assert.equal(checkMove(state, at(1000, 0), SPEED).state, state);
	}

	@Test
	public beginRejectsBrokenSamples() {
		Assert.undefined(beginMoveState(at(0 / 0, 0)));
		Assert.undefined(beginMoveState(at(0, math.huge)));
		Assert.undefined(beginMoveState(at(0, 0, 0 / 0)));
	}

	@Test
	public checkNeverModifiesItsInput() {
		const state = start();
		checkMove(state, at(500, 0.25), SPEED);
		Assert.equal(state.x, 0);
		Assert.equal(state.strikes, 0);
	}
}

export = MoveCheckTests;
