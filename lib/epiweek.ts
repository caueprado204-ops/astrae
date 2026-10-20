/**
 * Agregação de séries diárias em semanas epidemiológicas (domingo a sábado),
 * usando as datas de início de semana informadas pela própria fonte de saúde.
 * Uma semana só recebe valor se tiver pelo menos `minDays` dias válidos (padrão 5 de 7).
 */
export type Agg = "mean" | "sum";

const addDays = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400e3).toISOString().slice(0, 10);

export function aggregateToWeeks(weekStarts: string[], daily: Map<string, number | null>, agg: Agg, minDays = 5) {
  return weekStarts.map((start) => {
    const vals: number[] = [];
    for (let i = 0; i < 7; i++) {
      const v = daily.get(addDays(start, i));
      if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
    }
    if (vals.length < minDays) return { start, value: null as number | null, days: vals.length };
    const s = vals.reduce((a, b) => a + b, 0);
    // soma de chuva com dias faltantes é extrapolada proporcionalmente (7/dias) e isso é registrado em `days`
    return { start, value: agg === "mean" ? s / vals.length : (s * 7) / vals.length, days: vals.length };
  });
}

/** "202403" → { year: 2024, week: 3 } */
export const splitSE = (se: number) => ({ year: Math.floor(se / 100), week: se % 100 });
