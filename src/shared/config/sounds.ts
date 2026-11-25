// Sound effects. Client only plays them; nothing here affects game rules.
// RULE (CLAUDE.md): only audio we have the right to use: our own uploads, or Creator Store sounds from libraries
// licensed to Roblox creators (ProSoundEffects, RBLXEssentials). Never paste an id of a game rip ("Windows error",
// sounds from other games). An empty assetId keeps the sound silent.
import type { OreId } from "./ores";

export type SoundId =
	"hit" | "success" | "error" | "chestOpen" | "chestRare" | "machineStart" | "machineDone" | "machineCollect";

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
const SHALE_DEEP = "rbxassetid://9119050772"; // "Shale Break Low End Crackling Rock 6 (SFX)", ProSoundEffects
const ROCK_DROP_2 = "rbxassetid://9118587494"; // "Rock Drop On Concrete Drops Breaks 2 (SFX)", ProSoundEffects
const ROCK_DROP_3 = "rbxassetid://9118587698"; // "Rock Drop On Concrete Drops Breaks 3 (SFX)", ProSoundEffects
const ROCK_DROP_4 = "rbxassetid://9118587701"; // "Rock Drop On Concrete Drops Breaks 4 (SFX)", ProSoundEffects
const WHOOSH_FIRE = "rbxassetid://9120696702"; // "Whoosh By Airy Whomping Humming Rumbling 12 (SFX)", ProSoundEffects
const REWARD_RISE_1 = "rbxassetid://88130568524452"; // "SS_wobbleboxx_rewards_Rise01", RBLXEssentials
const REWARD_RISE_2 = "rbxassetid://97069579625373"; // "SS_wobbleboxx_rewards_Rise02", RBLXEssentials
const REWARD_RISE_3 = "rbxassetid://137298617974043"; // "SS_wobbleboxx_rewards_Rise03", RBLXEssentials
const REWARD_COIN = "rbxassetid://92486275191948"; // "SS_wobbleboxx_rewards_Coin01", RBLXEssentials
const REWARD_FX = "rbxassetid://138007687545003"; // "SS_wobbleboxx_rewards_FX01", RBLXEssentials

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
};

/** The break sound of every ore: a different sound or pitch each, so the player hears what broke. */
export const ORE_BREAK_SOUNDS: { readonly [K in OreId]: SoundDef } = {
	coal: { assetId: ROCK_DROP_2, volume: 0.6, minGap: 0.1, speed: 0.9 },
	copper: { assetId: ROCK_DROP_3, volume: 0.6, minGap: 0.1, speed: 1.05 },
	iron: { assetId: METAL_CLANG, volume: 0.5, minGap: 0.1, speed: 0.95 },
	quartz: { assetId: SHALE_LIGHT, volume: 0.6, minGap: 0.1, speed: 1.35 },
	silver: { assetId: METAL_HITS, volume: 0.6, minGap: 0.1, speed: 1.25 },
	gold: { assetId: METAL_CLANG, volume: 0.6, minGap: 0.1, speed: 1.3 },
	obsidian: { assetId: SHALE_DEEP, volume: 0.7, minGap: 0.1, speed: 0.75 },
	cobalt: { assetId: ROCK_DROP_4, volume: 0.7, minGap: 0.1, speed: 0.8 },
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
];

/** True for "" (silent) and "rbxassetid://<digits>". Anything else is a typo in the config. */
export function isValidAssetId(value: string): boolean {
	return value === "" || string.match(value, "^rbxassetid://%d+$")[0] !== undefined;
}
