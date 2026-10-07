import type { DataKind } from "@/types/science";

export interface GibsLayer {
  id: string; title: string; tileMatrixSet: string; maxZoom: number; ext: "png" | "jpg";
  defaultTime?: string; timeRanges: string[]; periodicity?: string; legendUrl?: string; hasTime: boolean;
}
export interface Variable { key: string; label: string; kind: DataKind; available: boolean; layers: GibsLayer[]; note?: string }

/** Ajusta a data pedida à resolução temporal da camada e ao último dado publicado. */
export function snapTime(layer: GibsLayer, date: string): string {
  if (!layer.hasTime) return "default";
  let d = date;
  const latest = layer.defaultTime?.slice(0, 10);
  if (latest && d > latest) d = latest;
  if (layer.periodicity === "P1M") return `${d.slice(0, 7)}-01`;
  if (layer.periodicity === "P1Y") return `${d.slice(0, 4)}-01-01`;
  return d;
}

export function tileUrl(layer: GibsLayer, time: string) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.id}/default/${time}/${layer.tileMatrixSet}/{z}/{y}/{x}.${layer.ext}`;
}

export const REGIONS: Record<string, { label: string; bounds: [[number, number], [number, number]] }> = {
  global: { label: "Global", bounds: [[-180, -70], [180, 75]] },
  brazil: { label: "Brasil", bounds: [[-74.5, -34], [-34.5, 5.5]] },
  southamerica: { label: "América do Sul", bounds: [[-82, -56], [-34, 13]] },
  amazon: { label: "Amazônia", bounds: [[-74, -13], [-44, 5]] },
  nino34: { label: "Pacífico — Niño 3.4", bounds: [[-190, -15], [-100, 15]] },
  pacific: { label: "Pacífico equatorial", bounds: [[-220, -25], [-75, 25]] },
  atlantic: { label: "Atlântico Sul", bounds: [[-60, -45], [15, 5]] }
};

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const daysAgo = (n: number) => new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);
