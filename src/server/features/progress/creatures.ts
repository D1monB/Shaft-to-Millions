// Wild creatures on the layers (decision 070): a pet model waits near ore on a layer someone has opened; holding its
// prompt offers ore from the bag. The server takes the food, rolls and adds the pet; the creature leaves either way.
import { CollectionService, Players, ReplicatedStorage, Workspace } from "@rbxts/services";
import { ATTRIBUTES, TAGS } from "shared/config/map-contract";
import { ORES, isOreId } from "shared/config/ores";
import {
	CREATURES,
	CREATURE_EVERY_SECONDS,
	CREATURE_LIFETIME_SECONDS,
	CreatureDef,
	TAMING_DISTANCE,
} from "shared/config/retention";
import { addItem } from "shared/features/chests";
import { nameKeys, ref, text } from "shared/features/i18n";
import { CREATURE_LAYER_ATTRIBUTE, CREATURE_TAG, canOffer, tames } from "shared/features/progress";
import { RateLimiter } from "shared/lib/rate-limiter";
import { getLoadedPlayers, getProfileData, markDirty } from "server/features/profile";
import { localizeLabel, localizePrompt } from "server/lib/localized";
import { notify } from "server/lib/notify";
import { getRootPosition } from "server/lib/proximity";

const random = new Random();
const limiter = new RateLimiter(3, 0.5);
const waiting = new Map<number, Model>();

function orePositions(layer: number): Vector3[] {
	const spots: Vector3[] = [];
	for (const node of CollectionService.GetTagged(TAGS.OreNode)) {
		const oreId = node.GetAttribute(ATTRIBUTES.OreId);
		if (isOreId(oreId) && ORES[oreId].layer === layer && node.IsDescendantOf(Workspace)) {
			const position = node.IsA("Model") ? node.GetPivot().Position : (node as BasePart).Position;
			spots.push(position);
		}
	}
	return spots;
}

/** The map author's pet model, or a glowing ball where it is missing. Anchored, no scripts, no collisions. */
function creatureModel(def: CreatureDef): Model {
	const template = ReplicatedStorage.FindFirstChild("PetModels")?.FindFirstChild(def.pet);
	const model = new Instance("Model");
	if (template !== undefined) {
		const copy = template.Clone();
		copy.Parent = model;
	} else {
		const ball = new Instance("Part");
		ball.Shape = Enum.PartType.Ball;
		ball.Size = new Vector3(2.5, 2.5, 2.5);
		ball.Material = Enum.Material.Neon;
		ball.Color = Color3.fromRGB(150, 110, 255);
		ball.Parent = model;
	}
	for (const part of model.GetDescendants()) {
		if (part.IsA("LuaSourceContainer")) {
			part.Destroy();
		} else if (part.IsA("BasePart")) {
			part.Anchored = true;
			part.CanCollide = false;
		}
	}
	return model;
}

function offer(player: Player, model: Model, def: CreatureDef): void {
	if (!limiter.tryTake(player.UserId, os.clock()) || model.Parent === undefined) {
		return;
	}
	const root = getRootPosition(player);
	const data = getProfileData(player);
	if (root === undefined || data === undefined || root.sub(model.GetPivot().Position).Magnitude > TAMING_DISTANCE) {
		return;
	}
	const check = canOffer(def, data.deepestLayer, data.bag[def.food] ?? 0, data.inventory.size());
	if (!check.ok) {
		const key =
			check.reason === "food" ? "taming.needFood" : check.reason === "layer" ? "taming.layer" : "aura.full";
		notify(player, text(key, { count: def.amount, ore: ref(nameKeys.ore(def.food)) }), "error");
		return;
	}
	// The creature leaves first, so only one player's offering counts; food and pet move in the same frame.
	waiting.delete(def.layer);
	model.Destroy();
	data.bag[def.food] = (data.bag[def.food] ?? 0) - def.amount;
	if (tames(def, random.NextNumber()) && addItem(data.inventory, data.nextUid, def.pet) !== undefined) {
		data.nextUid += 1;
		notify(player, text("taming.success", { pet: ref(nameKeys.item(def.pet)) }), "success");
	} else {
		notify(player, text("taming.fled"), "info");
	}
	markDirty(player);
}

function decorate(model: Model, def: CreatureDef): void {
	const part = model.FindFirstChildWhichIsA("BasePart", true);
	if (part === undefined) {
		return;
	}
	const gui = new Instance("BillboardGui");
	gui.Size = UDim2.fromOffset(190, 34);
	gui.StudsOffsetWorldSpace = new Vector3(0, 3.5, 0);
	gui.MaxDistance = 80;
	const label = new Instance("TextLabel");
	label.BackgroundTransparency = 1;
	label.Size = UDim2.fromScale(1, 1);
	label.Font = Enum.Font.FredokaOne;
	label.TextScaled = true;
	label.TextColor3 = Color3.fromRGB(190, 255, 190);
	label.TextStrokeTransparency = 0.1;
	label.Parent = gui;
	localizeLabel(label, text("taming.label", { pet: ref(nameKeys.item(def.pet)) }));
	gui.Parent = part;
	const prompt = new Instance("ProximityPrompt");
	localizePrompt(
		prompt,
		text("taming.offer", { count: def.amount, ore: ref(nameKeys.ore(def.food)) }),
		text("taming.chance", { value: `${math.floor(def.chance * 100)}%` }),
	);
	prompt.HoldDuration = 1;
	prompt.RequiresLineOfSight = false;
	prompt.MaxActivationDistance = TAMING_DISTANCE - 3;
	prompt.Parent = part;
	prompt.Triggered.Connect((player) => {
		const [ok, err] = pcall(offer, player, model, def);
		if (!ok) {
			warn(`[taming] offer failed: ${err}`);
		}
	});
}

function spawnCreature(def: CreatureDef, parent: Instance): void {
	if (waiting.get(def.layer)?.Parent !== undefined) {
		return;
	}
	const spots = orePositions(def.layer);
	if (spots.size() === 0) {
		return;
	}
	const spot = spots[random.NextInteger(0, spots.size() - 1)];
	const model = creatureModel(def);
	model.Name = `Creature_${def.pet}`;
	model.PivotTo(new CFrame(spot.add(new Vector3(random.NextNumber(-4, 4), 6, random.NextNumber(-4, 4)))));
	model.SetAttribute(CREATURE_LAYER_ATTRIBUTE, def.layer);
	decorate(model, def);
	model.Parent = parent;
	CollectionService.AddTag(model, CREATURE_TAG);
	waiting.set(def.layer, model);
	task.delay(CREATURE_LIFETIME_SECONDS, () => {
		if (model.Parent !== undefined) {
			model.Destroy();
		}
	});
}

export function startCreatures(): void {
	const folder = new Instance("Folder");
	folder.Name = "Creatures";
	folder.Parent = Workspace;
	Players.PlayerRemoving.Connect((player) => limiter.forget(player.UserId));
	task.spawn(() => {
		for (;;) {
			task.wait(CREATURE_EVERY_SECONDS);
			let deepest = 0;
			for (const player of getLoadedPlayers()) {
				deepest = math.max(deepest, getProfileData(player)?.deepestLayer ?? 0);
			}
			const open = CREATURES.filter((def) => def.layer <= deepest);
			if (open.size() > 0) {
				const [ok, err] = pcall(spawnCreature, open[random.NextInteger(0, open.size() - 1)], folder);
				if (!ok) {
					warn(`[taming] spawn failed: ${err}`);
				}
			}
		}
	});
}
