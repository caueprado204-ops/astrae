import "server-only";
import { fetchJson } from "@/lib/http";
import type { Series } from "@/types/science";

/**
 * NASA POWER (Prediction Of Worldwide Energy Resources) — NASA Langley.
 * Docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
 * Sem chave. Meteorologia derivada da reanálise MERRA-2 (GMAO) + GEOS FP-IT; radiação de CERES.
 * Portanto é classificado como MODEL (reanálise), não como observação de estação.
 */

export const POWER_PARAMS = {
  T2M: { label: "Temperatura do ar (2 m)", group: "temperature" },
  T2M_MAX: { label: "Temperatura máxima (2 m)", group: "temperature" },
  T2M_MIN: { label: "Temperatura mínima (2 m)", group: "temperature" },
  PRECTOTCORR: { label: "Precipitação (corrigida)", group: "precipitation" },
  PS: { label: "Pressão à superfície", group: "pressure" },
  RH2M: { label: "Umidade relativa (2 m)", group: "humidity" },
  WS10M: { label: "Velocidade do vento (10 m)", group: "wind" },
  ALLSKY_SFC_SW_DWN: { label: "Radiação solar incidente (céu real)", group: "radiation" }
} as const;
export type PowerParam = keyof typeof POWER_PARAMS;

export const isPowerParam = (p: string): p is PowerParam => p in POWER_PARAMS;

interface DailyResp {
  geometry?: { coordinates: [number, number, number] };
  header?: { fill_value?: number; start?: string; end?: string; sources?: string[]; title?: string };
  properties: { parameter: Record<string, Record<string, number>> };
  parameters?: Record<string, { units: string; longname: string }>;
}

const ymd = (iso: string) => iso.replaceAll("-", "");
const isoFromYmd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

export function powerDailyUrl(lat: number, lon: number, params: PowerParam[], start: string, end: string) {
  const q = new URLSearchParams({
    parameters: params.join(","),
    community: "AG",
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start: ymd(start),
    end: ymd(end),
    format: "JSON",
    "time-standard": "UTC"
  });
  return `https://power.larc.nasa.gov/api/temporal/daily/point?${q}`;
}

export async function getPowerDaily(lat: number, lon: number, params: PowerParam[], start: string, end: string) {
  const url = powerDailyUrl(lat, lon, params, start, end);
  const raw = await fetchJson<DailyResp>(url, { timeoutMs: 30000 });
  const fill = raw.header?.fill_value ?? -999;
  const series: Series[] = params.map((p) => {
    const values = raw.properties.parameter[p] || {};
    return {
      id: `power:${p}`,
      label: raw.parameters?.[p]?.longname || POWER_PARAMS[p].label,
      unit: raw.parameters?.[p]?.units || "",
      kind: "MODEL",
      points: Object.entries(values).map(([k, v]) => ({ t: isoFromYmd(k), v: v === fill ? null : v }))
    };
  });
  return { series, url, elevation: raw.geometry?.coordinates?.[2], sources: raw.header?.sources };
}

interface ClimResp {
  header?: { start?: string; end?: string; fill_value?: number };
  properties: { parameter: Record<string, Record<string, number>> };
  parameters?: Record<string, { units: string; longname: string }>;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Climatologia mensal de longo prazo do POWER para o ponto — base para anomalias. */
export async function getPowerClimatology(lat: number, lon: number, params: PowerParam[]) {
  const q = new URLSearchParams({
    parameters: params.join(","), community: "AG",
    latitude: lat.toFixed(4), longitude: lon.toFixed(4), format: "JSON"
  });
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?${q}`;
  const raw = await fetchJson<ClimResp>(url, { timeoutMs: 30000 });
  const out: Record<string, { monthly: (number | null)[]; annual: number | null; unit: string }> = {};
  const fill = raw.header?.fill_value ?? -999;
  for (const p of params) {
    const v = raw.properties.parameter[p] || {};
    out[p] = {
      monthly: MONTHS.map((m) => (v[m] === undefined || v[m] === fill ? null : v[m])),
      annual: v.ANN === undefined || v.ANN === fill ? null : v.ANN,
      unit: raw.parameters?.[p]?.units || ""
    };
  }
  return { climatology: out, url, period: raw.header?.start && raw.header?.end ? `${raw.header.start}–${raw.header.end}` : undefined };
}

/** Anomalia diária = valor diário − média climatológica do mês correspondente. */
export function dailyAnomaly(series: Series, monthly: (number | null)[]): Series {
  return {
    ...series,
    id: `${series.id}:anomaly`,
    label: `${series.label} — anomalia vs. climatologia POWER`,
    points: series.points.map((p) => {
      const m = Number(p.t.slice(5, 7)) - 1;
      const base = monthly[m];
      return { t: p.t, v: p.v == null || base == null ? null : Math.round((p.v - base) * 100) / 100 };
    })
  };
}
