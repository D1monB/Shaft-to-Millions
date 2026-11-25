// Equipment: equip/unequip/sell requests, and the bonuses fed into selling, movement and mining.
// Bonuses are always recomputed from saved data with the shared formula: nothing about them is trusted.
import { text } from "shared/features/i18n";
import { Players } from "@rbxts/services";
import { ITEMS, ItemId, RARITY_COLORS } from "shared/config/items";
import {
	EQUIP_BEST_REMOTE,
	EQUIP_REMOTE,
	PETS_ATTRIBUTE,
	SELL_ITEM_REMOTE,
	UNEQUIP_REMOTE,
	bestLoadout,
	computeBonuses,
	encodePets,
	equipItem,
	sellItem,
	unequipItem,
} from "shared/features/equipment";
import { ProfileData } from "shared/features/profile";
import { formatMoney } from "shared/lib/format";
import { RateLimiter } from "shared/lib/rate-limiter";
import { isShortString } from "shared/lib/validate";
import { setYieldBonusProvider } from "server/features/mining";
import { setSpeedBonusProvider } from "server/features/movement";
import { getLoadedPlayers, getProfileData, markDirty } from "server/features/profile";
import { setSellMultiplierProvider } from "server/features/selling";
import { notify } from "server/lib/notify";
import { logAbuse, onClientRequest } from "server/lib/remotes";

function bonusesOf(player: Player) {
	const data = getProfileData(player);
	return data === undefined ? undefined : computeBonuses(data.inventory, data.equipped);
}

function withUid(name: string, handler: (player: Player, uid: string) => void) {
	return (player: Player, args: Array<unknown>) => {
		const [uid] = args;
		if (args.size() !== 1 || !isShortString(uid, 16)) {
			logAbuse(player, `bad ${name} arguments`);
			return;
		}
		handler(player, uid);
	};
}

function handleEquip(player: Player, uid: string): void {
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	const result = equipItem(data.inventory, data.equipped, uid);
	if (result.ok) {
		markDirty(player);
	} else if (result.reason === "pet-slots-full") {
		notify(player, text("equip.petsFull"), "error");
	}
}

function handleUnequip(player: Player, uid: string): void {
	const data = getProfileData(player);
	if (data !== undefined && unequipItem(data.equipped, uid)) {
		markDirty(player);
	}
}

function handleSellItem(player: Player, uid: string): void {
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	const value = sellItem(data.inventory, data.equipped, uid);
	if (value > 0) {
		data.money += value;
		data.stats.totalEarned += value;
		markDirty(player);
		notify(player, text("equip.soldFor", { money: formatMoney(value) }), "success");
	}
}

function handleEquipBest(player: Player, args: Array<unknown>): void {
	const data = getProfileData(player);
	if (data === undefined || args.size() !== 0) {
		return;
	}
	data.equipped = bestLoadout(data.inventory);
	markDirty(player);
}

// ---------------------------------------------------------------- visuals

const VISUAL_NAME = "EquipmentVisuals";

function rgb(color: readonly [number, number, number]): Color3 {
	return Color3.fromRGB(color[0], color[1], color[2]);
}

/**
 * Publishes the equipped pets as a Player attribute. Every client draws and moves the pets itself (see the pets
 * controller), so the server does no per-frame work and welded parts never fight the camera or network ownership.
 */
function publishPets(player: Player, data: ProfileData): void {
	const ids: ItemId[] = [];
	for (const uid of data.equipped.pets) {
		const owned = data.inventory.find((entry) => entry.uid === uid);
		if (owned !== undefined) {
			ids.push(owned.item);
		}
	}
	const text = encodePets(ids);
	if (player.GetAttribute(PETS_ATTRIBUTE) !== text) {
		player.SetAttribute(PETS_ATTRIBUTE, text);
	}
}

/** Sparkles for auras (pets are drawn by clients). Rebuilt only when the loadout changes. */
function refreshVisuals(player: Player, lastSignature: Map<Player, string>): void {
	const data = getProfileData(player);
	if (data === undefined) {
		return;
	}
	publishPets(player, data);
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	if (root === undefined || !root.IsA("BasePart")) {
		return;
	}
	const signature = `${data.equipped.speedAura}|${data.equipped.pickaxeAura}|${root}`;
	if (lastSignature.get(player) === signature && root.FindFirstChild(VISUAL_NAME) !== undefined) {
		return;
	}
	lastSignature.set(player, signature);
	root.FindFirstChild(VISUAL_NAME)?.Destroy();
	const folder = new Instance("Folder");
	folder.Name = VISUAL_NAME;

	for (const uid of [data.equipped.speedAura, data.equipped.pickaxeAura]) {
		const owned = uid === undefined ? undefined : data.inventory.find((entry) => entry.uid === uid);
		if (owned !== undefined) {
			const sparkles = new Instance("Sparkles");
			sparkles.SparkleColor = rgb(RARITY_COLORS[ITEMS[owned.item].rarity]);
			sparkles.Parent = folder;
		}
	}
	folder.Parent = root;
}

export function startEquipmentService(): void {
	onClientRequest(EQUIP_REMOTE, new RateLimiter(10, 4), withUid("EquipItem", handleEquip));
	onClientRequest(UNEQUIP_REMOTE, new RateLimiter(10, 4), withUid("UnequipItem", handleUnequip));
	onClientRequest(SELL_ITEM_REMOTE, new RateLimiter(6, 3), withUid("SellItem", handleSellItem));
	onClientRequest(EQUIP_BEST_REMOTE, new RateLimiter(3, 1), handleEquipBest);

	setSellMultiplierProvider((player) => bonusesOf(player)?.sellMultiplier ?? 1);
	setSpeedBonusProvider((player) => bonusesOf(player)?.speedBonus ?? 0);
	setYieldBonusProvider((player) => bonusesOf(player)?.yieldBonus ?? 0);

	const signatures = new Map<Player, string>();
	Players.PlayerRemoving.Connect((player) => signatures.delete(player));
	task.spawn(() => {
		for (;;) {
			task.wait(1);
			for (const player of getLoadedPlayers()) {
				const [ok, err] = pcall(refreshVisuals, player, signatures);
				if (!ok) {
					warn(`[equipment] visuals failed for ${player.UserId}: ${err}`);
				}
			}
		}
	});
}
