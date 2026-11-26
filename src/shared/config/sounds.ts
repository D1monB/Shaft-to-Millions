// Sound effects. Client only plays them; nothing here affects game rules.
// RULE (CLAUDE.md): only audio we have the right to use: our own uploads, or Creator Store sounds from libraries
// licensed to Roblox creators (ProSoundEffects, RBLXEssentials). Never paste an id of a game rip ("Windows error",
// sounds from other games). An empty assetId keeps the sound silent.
import type { OreId } from "./ores";

export type SoundId =
	| "hit"
	| "success"
	| "error"
	| "chestOpen"
	| "chestRare"
	| "machineStart"
	| "machineDone"
	| "machineCollect"
	| "machineWork";

export interface SoundDef {
	/** "rbxassetid://<number>" or "" (silent). */
	readonly assetId: string;
	/** 0..1 */
	readonly volume: number;
	/** Minimum seconds between two plays, so spam (fast swings, many toasts) never turns into noise. */
	readonly minGap: number;
	/** Pitch and speed, 1 = original. Lets one licensed sound give several distinct ore sounds. */
	readonly speed?: number;
}

// Licensed sources (Creator Store):
const METAL_HITS = "rbxassetid://9116651255"; // "Metal Hits 2 (SFX)", ProSoundEffects
const METAL_CLANG = "rbxassetid://9125819216"; // "Robot Impact Miscellaneous Metal Clangs", ProSoundEffects
const SHALE_LIGHT = "rbxassetid://9119050283"; // "Shale Break Low End Crackling Rock 1 (SFX)", ProSoundEffects
const ROCK_DROP_3 = "rbxassetid://9118587698"; // "Rock Drop On Concrete Drops Breaks 3 (SFX)", ProSoundEffects
const WHOOSH_FIRE = "rbxassetid://9120696702"; // "Whoosh By Airy Whomping Humming Rumbling 12 (SFX)", ProSoundEffects
const REWARD_RISE_1 = "rbxassetid://88130568524452"; // "SS_wobbleboxx_rewards_Rise01", RBLXEssentials
const REWARD_RISE_2 = "rbxassetid://97069579625373"; // "SS_wobbleboxx_rewards_Rise02", RBLXEssentials
const REWARD_RISE_3 = "rbxassetid://137298617974043"; // "SS_wobbleboxx_rewards_Rise03", RBLXEssentials
const REWARD_COIN = "rbxassetid://92486275191948"; // "SS_wobbleboxx_rewards_Coin01", RBLXEssentials
const REWARD_FX = "rbxassetid://138007687545003"; // "SS_wobbleboxx_rewards_FX01", RBLXEssentials
const REFINERY_A = "rbxassetid://9112839126"; // "Oil Refinery Ambience 1 (SFX)", ProSoundEffects, 31 s loop
const REFINERY_B = "rbxassetid://9112839293"; // "Oil Refinery Ambience 2 (SFX)", ProSoundEffects, 32 s loop
const REFINERY_C = "rbxassetid://9112839813"; // "Oil Refinery Ambience 1 (SFX)", ProSoundEffects (other take)
const ELECTRIC_ARC = "rbxassetid://9114236191"; // "Electric Arcing 2 (SFX)", ProSoundEffects
const ROBOT_BUZZ = "rbxassetid://9118575969"; // "Robot Zoom Low Pitch Rizzy Buzz Tone 10 (SFX)", ProSoundEffects

export const SOUNDS: { readonly [K in SoundId]: SoundDef } = {
	hit: { assetId: METAL_HITS, volume: 0.35, minGap: 0.08 },
	success: { assetId: REWARD_RISE_3, volume: 0.6, minGap: 0.2 },
	// Silent for now: no licensed error sound found yet.
	error: { assetId: "", volume: 0.6, minGap: 0.3 },
	chestOpen: { assetId: REWARD_FX, volume: 0.7, minGap: 0.3 },
	// Rare and better items get a bigger fanfare on top of the normal one.
	chestRare: { assetId: REWARD_RISE_2, volume: 0.8, minGap: 0.3 },
	machineStart: { assetId: WHOOSH_FIRE, volume: 0.35, minGap: 0.3 },
	machineDone: { assetId: REWARD_RISE_1, volume: 0.5, minGap: 1 },
	machineCollect: { assetId: REWARD_COIN, volume: 0.6, minGap: 0.2 },
	/** A line machine lets an item go (decision 049): positional, quiet, at most every 2 s per machine. */
	machineWork: { assetId: WHOOSH_FIRE, volume: 0.3, minGap: 2 },
};

/** The break sound of every ore: a different sound or pitch each, so the player hears what broke. */
export const ORE_BREAK_SOUNDS: { readonly [K in OreId]: SoundDef } = {
	copper: { assetId: ROCK_DROP_3, volume: 0.6, minGap: 0.1, speed: 1.05 },
	iron: { assetId: METAL_CLANG, volume: 0.5, minGap: 0.1, speed: 0.95 },
	silver: { assetId: METAL_CLANG, volume: 0.55, minGap: 0.1, speed: 1.15 },
	gold: { assetId: METAL_CLANG, volume: 0.6, minGap: 0.1, speed: 1.3 },
	titanium: { assetId: METAL_HITS, volume: 0.6, minGap: 0.1, speed: 1.15 },
	iridium: { assetId: SHALE_LIGHT, volume: 0.7, minGap: 0.1, speed: 1.4 },
};

export const SOUND_IDS: ReadonlyArray<SoundId> = [
	"hit",
	"success",
	"error",
	"chestOpen",
	"chestRare",
	"machineStart",
	"machineDone",
	"machineCollect",
	"machineWork",
];

/** True for "" (silent) and "rbxassetid://<digits>". Anything else is a typo in the config. */
export function isValidAssetId(value: string): boolean {
	return value === "" || string.match(value, "^rbxassetid://%d+$")[0] !== undefined;
}

/**
 * Each line machine's own sound (decision 051): a quiet loop it always makes once bought (heard only nearby) and a
 * short sound when it lets an item go. Three licensed factory loops at different pitches plus the licensed one-shots
 * give twelve distinct machines: the crusher rumbles low, the laser whines high. Keys are LINE_MACHINES ids.
 */
export interface MachineSoundDef {
	readonly loop: SoundDef;
	readonly work: SoundDef;
}

const LOOP_VOLUME = 0.22;
const WORK_VOLUME = 0.35;
const WORK_GAP = 2;
const loop = (assetId: string, speed: number): SoundDef => ({ assetId, volume: LOOP_VOLUME, minGap: 0, speed });
const work = (assetId: string, speed: number): SoundDef => ({ assetId, volume: WORK_VOLUME, minGap: WORK_GAP, speed });

export const MACHINE_SOUNDS: { readonly [machineId: string]: MachineSoundDef | undefined } = {
	M01: { loop: loop(REFINERY_B, 1.25), work: work(WHOOSH_FIRE, 1.5) }, // Hydro Washer: hissing water
	M02: { loop: loop(REFINERY_A, 0.6), work: work(METAL_CLANG, 0.8) }, // Jaw Crusher: deep rumble, clank
	M03: { loop: loop(REFINERY_C, 1.5), work: work(ELECTRIC_ARC, 1.3) }, // Magnetic Separator: hum, zap
	M04: { loop: loop(REFINERY_A, 0.8), work: work(WHOOSH_FIRE, 0.8) }, // Blast Furnace: roar, whoomp
	M05: { loop: loop(REFINERY_B, 1.6), work: work(WHOOSH_FIRE, 1.9) }, // Cryo Cooler: cold hiss
	M06: { loop: loop(REFINERY_C, 0.7), work: work(METAL_HITS, 0.9) }, // Rolling Mill: low grind, metal
	M07: { loop: loop(REFINERY_A, 0.95), work: work(METAL_CLANG, 0.6) }, // Hydraulic Press: heavy thump
	M08: { loop: loop(REFINERY_C, 1.9), work: work(ELECTRIC_ARC, 1.6) }, // Laser Cutter: high whine
	M09: { loop: loop(REFINERY_B, 0.9), work: work(SHALE_LIGHT, 1.4) }, // Chemical Bath: bubbling crackle
	M10: { loop: loop(REFINERY_C, 1.2), work: work(ELECTRIC_ARC, 0.9) }, // Robotic Welder: welding arc
	M11: { loop: loop(REFINERY_B, 1.9), work: work(ROBOT_BUZZ, 1.2) }, // Plasma Injector: buzz
	M12: { loop: loop(REFINERY_A, 1.4), work: work(ROBOT_BUZZ, 0.7) }, // Quantum Assembler: sci-fi tone
};
