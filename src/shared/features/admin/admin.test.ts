import { Assert, Test } from "@rbxts/lunit";
import { MAX_GIVE_MONEY, OWNER_USER_ID, isAllowed, parseAdminRequest, roleOf } from "./admin";

const DEV = 111;
const GUEST = 222;

class AdminTests {
	@Test
	public onlyTheOwnerIdIsTheOwner() {
		Assert.equal(roleOf(OWNER_USER_ID, false), "owner");
		Assert.equal(roleOf(DEV, true), "dev");
		Assert.equal(roleOf(GUEST, false), undefined);
	}

	@Test
	public hostileArgumentsAreDropped() {
		const bad: unknown[][] = [
			[],
			["money"],
			["money", GUEST],
			["money", GUEST, 0],
			["money", GUEST, -5],
			["money", GUEST, 1.5],
			["money", GUEST, 0 / 0],
			["money", GUEST, math.huge],
			["money", GUEST, MAX_GIVE_MONEY + 1],
			["money", GUEST, "100"],
			["money", 0, 100],
			["money", "me", 100],
			["delete", GUEST],
			["kick", GUEST, 1],
		];
		for (const args of bad) {
			Assert.equal(parseAdminRequest(args), undefined, `${args[0]} ${args[2]}`);
		}
		Assert.notEqual(parseAdminRequest(["money", GUEST, 100]), undefined);
		Assert.notEqual(parseAdminRequest(["kick", GUEST]), undefined);
	}

	@Test
	public guestsMayDoNothing() {
		const request = parseAdminRequest(["money", GUEST, 100]);
		Assert.notEqual(request, undefined);
		if (request !== undefined) {
			Assert.false(isAllowed(undefined, GUEST, request));
		}
	}

	@Test
	public developersCannotManageRolesOrTouchTheOwner() {
		const grant = parseAdminRequest(["grant", GUEST]);
		const kickOwner = parseAdminRequest(["kick", OWNER_USER_ID]);
		const kickGuest = parseAdminRequest(["kick", GUEST]);
		if (grant === undefined || kickOwner === undefined || kickGuest === undefined) {
			Assert.fail("requests did not parse");
			return;
		}
		Assert.false(isAllowed("dev", DEV, grant));
		Assert.false(isAllowed("dev", DEV, kickOwner));
		Assert.true(isAllowed("dev", DEV, kickGuest));
		Assert.true(isAllowed("owner", OWNER_USER_ID, grant));
		Assert.false(isAllowed("owner", OWNER_USER_ID, kickOwner));
	}

	@Test
	public onlyTheOwnerResetsProgress() {
		const reset = parseAdminRequest(["reset", GUEST]);
		const take = parseAdminRequest(["takeMoney", GUEST, 500]);
		if (reset === undefined || take === undefined) {
			Assert.fail("requests did not parse");
			return;
		}
		Assert.false(isAllowed("dev", DEV, reset));
		Assert.true(isAllowed("owner", OWNER_USER_ID, reset));
		Assert.true(isAllowed("dev", DEV, take));
		Assert.false(isAllowed(undefined, GUEST, take));
		for (const amount of [0, -500, 0 / 0, math.huge]) {
			Assert.equal(parseAdminRequest(["takeMoney", GUEST, amount]), undefined);
		}
	}
}

export = AdminTests;
