// Layers of the shaft, from the surface down. Names are our own (see docs/decisions.md).
// The ore list of a layer is derived from ores.ts, so adding an ore never needs an edit here.
import { ORES, ORE_IDS, OreId } from "./ores";

export interface LayerDef {
	readonly name: string;
	readonly mood: string;
}

/** Index = layer number (1-based). Index 0 is unused so `LAYERS[n]` reads naturally. */
export const LAYERS: { readonly [layer: number]: LayerDef | undefined } = {
	1: { name: "Сірі Пласти", mood: "Тихі сірі стіни, перші жили вугілля й міді." },
	2: { name: "Іржаві Порожнини", mood: "Руді печери з краплями води й блиском срібла." },
	3: { name: "Базальтова Глибина", mood: "Чорний камінь, жар і рідкісний кобальт." },
};

export const LAYER_COUNT = 3;

export function oresOfLayer(layer: number): OreId[] {
	return ORE_IDS.filter((id) => ORES[id].layer === layer);
}
