// Token bucket per key. Pure: the caller passes the current time, so it runs under Lune in unit tests.
// Used by every RemoteEvent handler (CLAUDE.md: rate limit per player, drop abuse).

interface Bucket {
	tokens: number;
	lastRefill: number;
}

export class RateLimiter {
	private readonly buckets = new Map<number, Bucket>();

	/**
	 * @param capacity how many requests may arrive in a burst
	 * @param refillPerSecond how many requests per second are allowed over time
	 */
	public constructor(
		private readonly capacity: number,
		private readonly refillPerSecond: number,
	) {}

	/** True if the request is allowed (and uses one token), false if the key is over its limit. */
	public tryTake(key: number, now: number): boolean {
		let bucket = this.buckets.get(key);
		if (bucket === undefined) {
			bucket = { tokens: this.capacity, lastRefill: now };
			this.buckets.set(key, bucket);
		}
		// math.max guards against a clock that goes backwards.
		const elapsed = math.max(0, now - bucket.lastRefill);
		bucket.tokens = math.min(this.capacity, bucket.tokens + elapsed * this.refillPerSecond);
		bucket.lastRefill = now;

		if (bucket.tokens < 1) {
			return false;
		}
		bucket.tokens -= 1;
		return true;
	}

	/** Frees the memory when a player leaves. */
	public forget(key: number): void {
		this.buckets.delete(key);
	}
}
