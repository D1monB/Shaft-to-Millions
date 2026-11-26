// The store (decision 057) owns MarketplaceService.ProcessReceipt: one callback for every Developer Product in the
// game. Features register what a product grants (chests register their chest products); the store applies the
// exactly-once rules of receipt.ts to all of them.
import { MarketplaceService, Players } from "@rbxts/services";
import { BOOSTERS, BOOSTER_IDS, CRYSTAL_PORTION_SECONDS } from "shared/config/boosters";
import { STORE_PRODUCTS, StoreProduct } from "shared/config/store";
import { ROBUX_CHESTS_ALLOWED_ATTRIBUTE } from "shared/features/chests";
import { text } from "shared/features/i18n";
import { ProfileData } from "shared/features/profile";
import { moneyPackAmount, needsRandomPolicy } from "shared/features/store";
import { formatMoney } from "shared/lib/format";
import { MAX_COUNTER } from "shared/lib/repair";
import { grantBoost } from "server/features/boosters";
import { getProfileData, markDirty, saveProfileNow } from "server/features/profile";
import { notify } from "server/lib/notify";
import { decideReceipt } from "./receipt";

export interface ProductHandler {
	/** True when the product is (or buys) a paid random item: refused for players whose policy restricts those. */
	readonly random: boolean;
	/** Adds what was bought. false = nothing was added (e.g. a full inventory); Roblox will retry later. */
	readonly grant: (player: Player, data: ProfileData) => boolean;
}

const handlers = new Map<number, ProductHandler>();
/** Crystal value of one portion of the cheapest booster: what capped boost time is refunded at. */
const CHEAPEST_BOOST_CRYSTALS = math.min(...BOOSTER_IDS.map((id) => BOOSTERS[id].crystalPrice));
const SAVE_TIMEOUT_SECONDS = 15;

/** Registers what a Developer Product grants. A second registration of the same id is a bug and is ignored. */
export function registerProduct(productId: number, handler: ProductHandler): void {
	if (handlers.has(productId)) {
		warn(`[store] product ${productId} registered twice; the second one is ignored`);
		return;
	}
	handlers.set(productId, handler);
}

/** Server-set by the chests feature from PolicyService; clients cannot change it. Missing = not allowed. */
function randomAllowed(player: Player): boolean {
	return player.GetAttribute(ROBUX_CHESTS_ALLOWED_ATTRIBUTE) === true;
}

function processReceipt(receipt: ReceiptInfo): Enum.ProductPurchaseDecision {
	const player = Players.GetPlayerByUserId(receipt.PlayerId);
	const handler = handlers.get(receipt.ProductId);
	if (player === undefined || handler === undefined) {
		return Enum.ProductPurchaseDecision.NotProcessedYet;
	}
	const decision = decideReceipt(receipt.PurchaseId, {
		getData: () => getProfileData(player),
		robuxAllowed: () => !handler.random || randomAllowed(player),
		grant: (data) => handler.grant(player, data),
		save: () => saveProfileNow(player, SAVE_TIMEOUT_SECONDS),
		notify: (message) => notify(player, message, "error"),
	});
	return decision === "granted"
		? Enum.ProductPurchaseDecision.PurchaseGranted
		: Enum.ProductPurchaseDecision.NotProcessedYet;
}

/** What one store product adds. Runs inside decideReceipt, in the same frame as the receipt id is recorded. */
function grantProduct(product: StoreProduct, player: Player, data: ProfileData): boolean {
	const grant = product.grant;
	if (grant.kind === "boost") {
		let added = 0;
		for (const id of grant.boosters) {
			added += grantBoost(player, data, id, grant.seconds);
		}
		if (added < grant.seconds * grant.boosters.size()) {
			// Boosters at their 24 h cap: the time that did not fit is paid back in crystals, never lost.
			const missing = grant.seconds * grant.boosters.size() - added;
			const refund = math.max(1, math.ceil((missing / CRYSTAL_PORTION_SECONDS) * CHEAPEST_BOOST_CRYSTALS));
			data.crystals = math.min(data.crystals + refund, MAX_COUNTER);
			notify(player, text("store.boostRefund", { count: refund }), "info");
		}
		notify(player, text("store.boostGranted"), "success");
	} else if (grant.kind === "crystals") {
		data.crystals = math.min(data.crystals + grant.amount, MAX_COUNTER);
		notify(player, text("store.crystalsGranted", { count: grant.amount }), "success");
	} else {
		const amount = moneyPackAmount(grant.amount, data.deepestLayer);
		data.money = math.min(data.money + amount, MAX_COUNTER);
		notify(player, text("store.moneyGranted", { money: formatMoney(amount) }), "success");
	}
	markDirty(player);
	return true;
}

export function startStoreService(): void {
	for (const product of STORE_PRODUCTS) {
		const productId = product.productId;
		if (productId !== undefined) {
			registerProduct(productId, {
				random: needsRandomPolicy(product),
				grant: (player, data) => grantProduct(product, player, data),
			});
		}
	}
	MarketplaceService.ProcessReceipt = processReceipt;
}
