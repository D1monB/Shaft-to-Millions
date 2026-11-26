import { Assert, Test } from "@rbxts/lunit";
import { parseHitRequest } from "./hit-request";

interface FakeNode {
	readonly fake: "node";
}

const NODE: FakeNode = { fake: "node" };

function isNode(value: unknown): value is FakeNode {
	return value === NODE;
}

class HitRequestTests {
	@Test
	public aKnownNodeIsAHit() {
		const result = parseHitRequest([NODE], isNode);
		Assert.equal(result.kind, "hit");
		Assert.equal(result.kind === "hit" ? result.node : undefined, NODE);
	}

	@Test
	public aMissingNodeIsDroppedQuietly() {
		Assert.equal(parseHitRequest([], isNode).kind, "drop");
	}

	@Test
	public wrongTypesAreAbuse() {
		const bad: Array<unknown> = ["node", 5, 0 / 0, math.huge, true, {}, { fake: "node" }];
		for (const value of bad) {
			Assert.equal(parseHitRequest([value], isNode).kind, "abuse");
		}
	}

	@Test
	public extraArgumentsAreAbuse() {
		Assert.equal(parseHitRequest([NODE, NODE], isNode).kind, "abuse");
		Assert.equal(parseHitRequest([NODE, 999], isNode).kind, "abuse");
	}
}

export = HitRequestTests;
