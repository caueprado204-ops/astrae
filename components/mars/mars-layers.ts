export const MARS_LAYERS = {
  viking: { label: "Viking MDIM 2.1 — mosaico colorido", id: "Mars_Viking_MDIM21_ClrMosaic_global_232m", ext: "jpg", maxZoom: 7 },
  mola: { label: "MGS MOLA — relevo sombreado colorido", id: "Mars_MGS_MOLA_ClrShade_merge_global_463m", ext: "jpg", maxZoom: 6 }
} as const;
export type MarsLayerKey = keyof typeof MARS_LAYERS;

export interface MarsMarker { id: string; lat: number; lon: number; label: string; color: string; detail?: string }

