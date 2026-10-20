import { describe, laggedCorrelation, log1p, seasonalAnomaly, strength, type Method } from "@/lib/stats";

/** Parâmetros e resultados de uma análise clima × saúde — o objeto inteiro é exportado/salvo para reprodutibilidade. */
export interface AnalysisParams {
  geocode: string; place: string; disease: string; from: number; to: number;
  climateVar: string; outcome: "cases" | "incidence"; maxLag: number; method: Method;
  logOutcome: boolean; deseasonalize: boolean; dropRecentWeeks: number;
}

export interface Row { se: number; year: number; week: number; start: string; [k: string]: number | string | null }

export function runAnalysis(all: Row[], p: AnalysisParams) {
  const rows = p.dropRecentWeeks > 0 ? all.slice(0, Math.max(0, all.length - p.dropRecentWeeks)) : all;
  let y = rows.map((r) => r[p.outcome] as number | null);
  let x = rows.map((r) => r[p.climateVar] as number | null);
  if (p.logOutcome) y = y.map(log1p);
  const season = rows.map((r) => r.week);
  if (p.deseasonalize) { y = seasonalAnomaly(y, season); x = seasonalAnomaly(x, season); }
  const lags = laggedCorrelation(x, y, p.maxLag, p.method);
  const valid = lags.filter((l) => l.r != null);
  const peak = valid.length ? valid.reduce((a, b) => (Math.abs(b.r!) > Math.abs(a.r!) ? b : a)) : null;
  const years = new Set(rows.map((r) => r.year)).size;
  return {
    usedWeeks: rows.length, years, x, y, lags, peak,
    stats: { outcome: describe(rows.map((r) => r[p.outcome] as number | null)), climate: describe(rows.map((r) => r[p.climateVar] as number | null)) },
    peakStrength: strength(peak?.r ?? null)
  };
}

/** Perfil sazonal médio por semana epidemiológica (1…53). */
export function seasonalProfile(rows: Row[], key: string) {
  const acc = new Map<number, { s: number; n: number }>();
  rows.forEach((r) => { const v = r[key]; if (typeof v !== "number") return; const c = acc.get(r.week) || { s: 0, n: 0 }; c.s += v; c.n++; acc.set(r.week, c); });
  return Array.from({ length: 53 }, (_, i) => { const c = acc.get(i + 1); return { week: i + 1, v: c ? c.s / c.n : null }; });
}
