import { Assert, Test } from "@rbxts/lunit";
import { ProfileData, createDefaultProfileData } from "shared/features/profile";
import { ReceiptPorts, decideReceipt } from "./receipt";

class Harness {
	public data: ProfileData | undefined = createDefaultProfileData();
	public allowed = true;
	public grantWorks = true;
	public saveWorks = true;
	public grants = 0;
	public saves = 0;
	public notices: string[] = [];

	public readonly ports: ReceiptPorts = {
		getData: () => this.data,
		robuxAllowed: () => this.allowed,
		grant: () => {
			if (!this.grantWorks) {
				return false;
			}
			this.grants += 1;
			return true;
		},
		save: () => {
			this.saves += 1;
			return this.saveWorks;
		},
		notify: (text) => this.notices.push(text),
	};
}

class ReceiptTests {
	@Test
	public grantsAndSavesOnce() {
		const h = new Harness();
		Assert.equal(decideReceipt("p1", h.ports), "granted");
		Assert.equal(h.grants, 1);
		Assert.equal(h.saves, 1);
		Assert.true(h.data?.purchaseIds.includes("p1"));
	}

	@Test
	public retriedReceiptIsNeverGrantedTwice() {
		const h = new Harness();
		decideReceipt("p1", h.ports);
		Assert.equal(decideReceipt("p1", h.ports), "granted");
		Assert.equal(decideReceipt("p1", h.ports), "granted");
		Assert.equal(h.grants, 1);
	}

	@Test
	public failedSaveIsNotConfirmedButRetryDoesNotDuplicate() {
		const h = new Harness();
		h.saveWorks = false;
		Assert.equal(decideReceipt("p1", h.ports), "not-processed");
		Assert.equal(h.grants, 1);
		h.saveWorks = true;
		Assert.equal(decideReceipt("p1", h.ports), "granted");
		Assert.equal(h.grants, 1);
	}

	@Test
	public restrictedPlayerGetsNoRandomItem() {
		const h = new Harness();
		h.allowed = false;
		Assert.equal(decideReceipt("p1", h.ports), "not-processed");
		Assert.equal(h.grants, 0);
		Assert.false(h.data?.purchaseIds.includes("p1"));
		Assert.equal(h.notices.size(), 1);
	}

	@Test
	public playerNotLoadedIsRetriedLater() {
		const h = new Harness();
		h.data = undefined;
		Assert.equal(decideReceipt("p1", h.ports), "not-processed");
		Assert.equal(h.grants, 0);
	}

	@Test
	public fullInventoryForgetsTheIdSoItCanBeGrantedLater() {
		const h = new Harness();
		h.grantWorks = false;
		Assert.equal(decideReceipt("p1", h.ports), "not-processed");
		Assert.false(h.data?.purchaseIds.includes("p1"));
		h.grantWorks = true;
		Assert.equal(decideReceipt("p1", h.ports), "granted");
		Assert.equal(h.grants, 1);
	}

	@Test
	public differentReceiptsAreIndependent() {
		const h = new Harness();
		decideReceipt("p1", h.ports);
		decideReceipt("p2", h.ports);
		Assert.equal(h.grants, 2);
	}
}

export = ReceiptTests;
