import "server-only";
import { cached } from "@/lib/cache";
import { aggregateToWeeks, splitSE } from "@/lib/epiweek";
import { getArboWeeks, type Disease } from "@/services/health/infodengue";
import { getPowerDaily, type PowerParam } from "@/services/nasa/power";

/**
 * Eixo A — monta a tabela semanal (semana epidemiológica × variáveis) que alimenta as análises.
 * Saúde: InfoDengue (casos notificados por semana). Clima: NASA POWER diário (reanálise) agregado
 * nas mesmas semanas. Nenhum valor é imputado: semanas com menos de 5 dias válidos ficam vazias.
 */
export const CLIMATE_VARS: Record<string, { param: PowerParam; label: string; unit: string; agg: "mean" | "sum" }> = {
  tmean: { param: "T2M", label: "Temperatura média semanal", unit: "°C", agg: "mean" },
  tmax: { param: "T2M_MAX", label: "Temperatura máxima (média semanal)", unit: "°C", agg: "mean" },
  tmin: { param: "T2M_MIN", label: "Temperatura mínima (média semanal)", unit: "°C", agg: "mean" },
  prec: { param: "PRECTOTCORR", label: "Precipitação acumulada na semana", unit: "mm", agg: "sum" },
  rh: { param: "RH2M", label: "Umidade relativa (média semanal)", unit: "%", agg: "mean" }
};

export interface WeekRow { se: number; year: number; week: number; start: string; cases: number | null; casesEst: number | null; incidence: number | null; population: number | null; tmean: number | null; tmax: number | null; tmin: number | null; prec: number | null; rh: number | null }

const MAX_SPAN = 5; // anos por chamada ao POWER (limite da rota pública da ASTRAE)

export async function buildWeeklyDataset(opts: { geocode: string; disease: Disease; from: number; to: number; lat: number; lon: number }) {
  const { geocode, disease, from, to, lat, lon } = opts;
  const arbo = await cached(`infodengue:${geocode}:${disease}:${from}-${to}`, 12 * 3600e3, () => getArboWeeks(geocode, disease, from, to));
  const weeks = arbo.value.weeks.filter((w) => splitSE(w.se).year >= from && splitSE(w.se).year <= to);
  if (weeks.length === 0) return { rows: [] as WeekRow[], urls: [arbo.value.url], municipality: undefined as string | undefined };

  // clima: POWER diário em blocos de até 5 anos, cobrindo a primeira à última semana (+6 dias)
  const first = weeks[0].weekStart, lastDay = new Date(Date.parse(weeks.at(-1)!.weekStart) + 6 * 86400e3).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const end = lastDay > today ? today : lastDay;
  const params = Object.values(CLIMATE_VARS).map((c) => c.param);
  const chunks: [string, string][] = [];
  for (let y = Number(first.slice(0, 4)); y <= Number(end.slice(0, 4)); y += MAX_SPAN) {
    const s = y === Number(first.slice(0, 4)) ? first : `${y}-01-01`;
    const eY = Math.min(y + MAX_SPAN - 1, Number(end.slice(0, 4)));
    chunks.push([s, eY === Number(end.slice(0, 4)) ? end : `${eY}-12-31`]);
  }
  const daily = await Promise.all(chunks.map(([s, e]) =>
    cached(`power:daily:${lat.toFixed(3)}:${lon.toFixed(3)}:${s}:${e}:${params.join(",")}`, 24 * 3600e3, () => getPowerDaily(lat, lon, params, s, e))));
  const byParam = new Map<string, Map<string, number | null>>();
  daily.forEach((d) => d.value.series.forEach((s, i) => {
    const m = byParam.get(params[i]) || new Map();
    s.points.forEach((p) => m.set(p.t, p.v));
    byParam.set(params[i], m);
  }));

  const starts = weeks.map((w) => w.weekStart);
  const agg = Object.fromEntries(Object.entries(CLIMATE_VARS).map(([k, c]) => [k, aggregateToWeeks(starts, byParam.get(c.param) || new Map(), c.agg)]));
  const rows: WeekRow[] = weeks.map((w, i) => ({
    se: w.se, ...splitSE(w.se), start: w.weekStart, cases: w.cases, casesEst: w.casesEst, incidence: w.incidence, population: w.population,
    tmean: agg.tmean[i].value, tmax: agg.tmax[i].value, tmin: agg.tmin[i].value, prec: agg.prec[i].value, rh: agg.rh[i].value
  }));
  return { rows, urls: [arbo.value.url, ...daily.map((d) => d.value.url)], municipality: weeks.at(-1)?.municipality };
}
