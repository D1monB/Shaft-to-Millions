import { Assert, Test } from "@rbxts/lunit";
import { RateLimiter } from "./rate-limiter";

class RateLimiterTests {
	@Test
	public allowsABurstUpToCapacity() {
		const limiter = new RateLimiter(3, 1);
		Assert.true(limiter.tryTake(1, 0));
		Assert.true(limiter.tryTake(1, 0));
		Assert.true(limiter.tryTake(1, 0));
		Assert.false(limiter.tryTake(1, 0));
	}

	@Test
	public refillsOverTime() {
		const limiter = new RateLimiter(2, 1);
		limiter.tryTake(1, 0);
		limiter.tryTake(1, 0);
		Assert.false(limiter.tryTake(1, 0.5));
		Assert.true(limiter.tryTake(1, 1.5));
	}

	@Test
	public neverRefillsAboveCapacity() {
		const limiter = new RateLimiter(2, 1);
		Assert.true(limiter.tryTake(1, 0));
		// A long pause must not bank more than `capacity` requests.
		Assert.true(limiter.tryTake(1, 1000));
		Assert.true(limiter.tryTake(1, 1000));
		Assert.false(limiter.tryTake(1, 1000));
	}

	@Test
	public keysAreIndependent() {
		const limiter = new RateLimiter(1, 0);
		Assert.true(limiter.tryTake(1, 0));
		Assert.false(limiter.tryTake(1, 0));
		Assert.true(limiter.tryTake(2, 0));
	}

	@Test
	public spamIsMostlyRejected() {
		const limiter = new RateLimiter(5, 2);
		let allowed = 0;
		for (let i = 0; i < 1000; i++) {
			if (limiter.tryTake(1, 0)) {
				allowed += 1;
			}
		}
		Assert.equal(allowed, 5);
	}

	@Test
	public backwardsClockDoesNotGiveFreeTokens() {
		const limiter = new RateLimiter(1, 10);
		Assert.true(limiter.tryTake(1, 100));
		Assert.false(limiter.tryTake(1, 50));
	}

	@Test
	public forgetResetsTheKey() {
		const limiter = new RateLimiter(1, 0);
		limiter.tryTake(1, 0);
		limiter.forget(1);
		Assert.true(limiter.tryTake(1, 0));
	}
}

export = RateLimiterTests;
