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
