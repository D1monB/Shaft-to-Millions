// Plays sound effects from config/sounds.ts. Sounds are created once and reused (a small pool per sound),
// so fast mining never creates hundreds of instances. A silent (empty) id is skipped.
import { SoundService } from "@rbxts/services";
import { SOUNDS, SoundId } from "shared/config/sounds";

/** Copies per sound: enough for quick overlapping hits without cutting each other off. */
const POOL_SIZE = 3;

const pools = new Map<SoundId, Sound[]>();
const nextIndex = new Map<SoundId, number>();
const lastPlayed = new Map<SoundId, number>();

function poolOf(id: SoundId): Sound[] {
	const existing = pools.get(id);
	if (existing !== undefined) {
		return existing;
	}
	const def = SOUNDS[id];
	const pool: Sound[] = [];
	for (let i = 0; i < POOL_SIZE; i++) {
		const sound = new Instance("Sound");
		sound.Name = `${id}_${i}`;
		sound.SoundId = def.assetId;
		sound.Volume = def.volume;
		sound.Parent = SoundService;
		pool.push(sound);
	}
	pools.set(id, pool);
	return pool;
}

/** Plays a sound effect for this player only. Never throws. */
export function playSound(id: SoundId): void {
	const def = SOUNDS[id];
	if (def.assetId === "") {
		return;
	}
	const now = os.clock();
	if (now - (lastPlayed.get(id) ?? -math.huge) < def.minGap) {
		return;
	}
	lastPlayed.set(id, now);
	const pool = poolOf(id);
	const index = nextIndex.get(id) ?? 0;
	nextIndex.set(id, (index + 1) % pool.size());
	pool[index].Play();
}
