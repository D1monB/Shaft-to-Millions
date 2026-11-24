import { Assert, Test } from "@rbxts/lunit";
import { clampFraction, formatCompact, formatCount, formatDuration, formatMoney, formatPercent } from "./format";

class FormatTests {
	@Test
	public compactNumbers() {
		Assert.equal(formatCompact(0), "0");
		Assert.equal(formatCompact(950), "950");
		Assert.equal(formatCompact(1000), "1K");
		Assert.equal(formatCompact(1234), "1.2K");
		Assert.equal(formatCompact(3_400_000), "3.4M");
		Assert.equal(formatCompact(2e9), "2B");
		Assert.equal(formatCompact(-1500), "-1.5K");
	}

	@Test
	public neverRoundsUpPastTheRealValue() {
		// 1999 must not show as "2K": the player would think they can afford a $2K item.
		Assert.equal(formatCompact(1999), "1.9K");
	}

	@Test
	public badNumbersShowZero() {
		Assert.equal(formatCompact(0 / 0), "0");
		Assert.equal(formatCompact(math.huge), "0");
		Assert.equal(formatMoney(0 / 0), "$0");
	}

	@Test
	public durations() {
		Assert.equal(formatDuration(0), "0:00");
		Assert.equal(formatDuration(65), "1:05");
		Assert.equal(formatDuration(3723), "1:02:03");
		Assert.equal(formatDuration(-5), "0:00");
		Assert.equal(formatDuration(0 / 0), "0:00");
		Assert.equal(formatDuration(0.2), "0:01");
	}

	@Test
	public percents() {
		Assert.equal(formatPercent(0.5), "50%");
		Assert.equal(formatPercent(0.125), "12.5%");
		Assert.equal(formatPercent(0.0001), "0%");
		Assert.equal(formatPercent(0 / 0), "0%");
	}

	@Test
	public fractionsAreClamped() {
		Assert.equal(clampFraction(0.25), 0.25);
		Assert.equal(clampFraction(-1), 0);
		Assert.equal(clampFraction(7), 1);
		Assert.equal(clampFraction(0 / 0), 0);
		Assert.equal(clampFraction(math.huge), 0);
		Assert.equal(clampFraction(-math.huge), 0);
	}

	@Test
	public counts() {
		Assert.equal(formatCount(12, 25), "12/25");
		Assert.equal(formatCount(12.7, 25), "12/25");
		Assert.equal(formatCount(0 / 0, 25), "0/25");
		Assert.equal(formatCount(5, math.huge), "5/0");
	}
}

export = FormatTests;
