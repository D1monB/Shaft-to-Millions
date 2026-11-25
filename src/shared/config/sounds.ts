// Sound effects. Client only plays them; nothing here affects game rules.
// RULE (CLAUDE.md): only audio we have the right to use: our own uploads, or sounds published by Roblox in the
// Creator Store. Never paste an id found on the internet. An empty assetId keeps the sound silent, so the game works
// before the sounds are chosen.

export type SoundId = "hit" | "oreBreak" | "success" | "error";

export interface SoundDef {
	/** "rbxassetid://<number>" or "" (silent). */
	readonly assetId: string;
	/** 0..1 */
	readonly volume: number;
	/** Minimum seconds between two plays, so spam (fast swings, many toasts) never turns into noise. */
	readonly minGap: number;
}

export const SOUNDS: { readonly [K in SoundId]: SoundDef } = {
	hit: { assetId: "", volume: 0.5, minGap: 0.08 },
	oreBreak: { assetId: "", volume: 0.7, minGap: 0.1 },
	success: { assetId: "", volume: 0.6, minGap: 0.2 },
	error: { assetId: "", volume: 0.6, minGap: 0.3 },
};

export const SOUND_IDS: ReadonlyArray<SoundId> = ["hit", "oreBreak", "success", "error"];

/** True for "" (silent) and "rbxassetid://<digits>". Anything else is a typo in the config. */
export function isValidAssetId(value: string): boolean {
	return value === "" || string.match(value, "^rbxassetid://%d+$")[0] !== undefined;
}
