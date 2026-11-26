// Plays sound effects from config/sounds.ts. Sounds are created once and reused (a small pool per sound),
// so fast mining never creates hundreds of instances. A silent (empty) id is skipped.
import { SoundService } from "@rbxts/services";
import { ORE_BREAK_SOUNDS, SOUNDS, SoundDef, SoundId } from "shared/config/sounds";
import { OreId } from "shared/config/ores";

/** Copies per sound: enough for quick overlapping hits without cutting each other off. */
const POOL_SIZE = 3;

const pools = new Map<string, Sound[]>();
const nextIndex = new Map<string, number>();
const lastPlayed = new Map<string, number>();

function poolOf(key: string, def: SoundDef): Sound[] {
	const existing = pools.get(key);
	if (existing !== undefined) {
		return existing;
	}
	const pool: Sound[] = [];
	for (let i = 0; i < POOL_SIZE; i++) {
		const sound = new Instance("Sound");
		sound.Name = `${key}_${i}`;
		sound.SoundId = def.assetId;
		sound.Volume = def.volume;
		sound.PlaybackSpeed = def.speed ?? 1;
		sound.Parent = SoundService;
		pool.push(sound);
	}
	pools.set(key, pool);
	return pool;
}

function play(key: string, def: SoundDef): void {
	if (def.assetId === "") {
		return;
	}
	const now = os.clock();
	if (now - (lastPlayed.get(key) ?? -math.huge) < def.minGap) {
		return;
	}
	lastPlayed.set(key, now);
	const pool = poolOf(key, def);
	const index = nextIndex.get(key) ?? 0;
	nextIndex.set(key, (index + 1) % pool.size());
	pool[index].Play();
}

/** Plays a sound effect for this player only. Never throws. */
export function playSound(id: SoundId): void {
	play(id, SOUNDS[id]);
}

/** The break sound of this ore (each ore sounds different). */
export function playOreBreak(oreId: OreId): void {
	play(`ore_${oreId}`, ORE_BREAK_SOUNDS[oreId]);
}

/** Positional copies, each on its own attachment, moved to where the sound happens. */
const POSITIONAL_POOL_SIZE = 6;
const positional = new Map<string, Attachment[]>();

/** Sounds this loud this far away (studs) fade out: machines are heard on your plot, not across the map. */
const POSITIONAL_MAX_DISTANCE = 90;

/**
 * Plays a sound at a place in the world (a machine on the belt). `key` throttles per source, so twelve machines
 * may each sound but one machine never machine-guns. Never throws.
 */
export function playSoundAt(id: SoundId, position: Vector3, key: string): void {
	playDefAt(SOUNDS[id], position, `${id}@${key}`);
}

/** Like playSoundAt, for a sound definition (a machine's own sound, decision 051). */
export function playDefAt(def: SoundDef, position: Vector3, throttleKey: string): void {
	const id = `${def.assetId}@${def.speed ?? 1}`;
	const now = os.clock();
	if (def.assetId === "" || now - (lastPlayed.get(throttleKey) ?? -math.huge) < def.minGap) {
		return;
	}
	lastPlayed.set(throttleKey, now);
	let pool = positional.get(id);
	if (pool === undefined) {
		pool = [];
		for (let i = 0; i < POSITIONAL_POOL_SIZE; i++) {
			const attachment = new Instance("Attachment");
			attachment.Name = `${id}_at_${i}`;
			const sound = new Instance("Sound");
			sound.SoundId = def.assetId;
			sound.Volume = def.volume;
			sound.PlaybackSpeed = def.speed ?? 1;
			sound.RollOffMaxDistance = POSITIONAL_MAX_DISTANCE;
			sound.Parent = attachment;
			attachment.Parent = game.Workspace.Terrain;
			pool.push(attachment);
		}
		positional.set(id, pool);
	}
	const index = nextIndex.get(`${id}@pos`) ?? 0;
	nextIndex.set(`${id}@pos`, (index + 1) % pool.size());
	const attachment = pool[index];
	attachment.WorldPosition = position;
	attachment.FindFirstChildOfClass("Sound")?.Play();
}
