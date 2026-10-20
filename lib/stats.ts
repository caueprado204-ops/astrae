/**
 * Estatística exploratória da ASTRAE.
 * Regras: valores ausentes (null/NaN) são excluídos par a par e o n efetivo é sempre devolvido;
 * nada aqui produz p-valor — séries climáticas e epidemiológicas são autocorrelacionadas e sazonais,
 * o que invalida os testes clássicos de independência. Os resultados são descritivos/exploratórios.
 */

export type Num = number | null | undefined;
const ok = (v: Num): v is number => typeof v === "number" && Number.isFinite(v);

export interface Describe { n: number; missing: number; mean: number | null; sd: number | null; min: number | null; p25: number | null; median: number | null; p75: number | null; max: number | null }

export function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function describe(values: Num[]): Describe {
  const v = values.filter(ok).sort((a, b) => a - b);
  const n = v.length;
  const mean = n ? v.reduce((a, b) => a + b, 0) / n : null;
  const sd = n > 1 && mean != null ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  return { n, missing: values.length - n, mean, sd, min: n ? v[0] : null, p25: quantile(v, 0.25), median: quantile(v, 0.5), p75: quantile(v, 0.75), max: n ? v[n - 1] : null };
}

/** Pares completos (exclusão par a par). */
export function pairs(x: Num[], y: Num[]): [number[], number[]] {
  const a: number[] = [], b: number[] = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (ok(x[i]) && ok(y[i])) { a.push(x[i] as number); b.push(y[i] as number); }
  return [a, b];
}

export function pearson(x: Num[], y: Num[]): { r: number | null; n: number } {
  const [a, b] = pairs(x, y);
  const n = a.length;
  if (n < 3) return { r: null, n };
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return { r: saa === 0 || sbb === 0 ? null : sab / Math.sqrt(saa * sbb), n };
}

/** Postos médios (empates recebem a média dos postos). */
export function ranks(v: number[]): number[] {
  const idx = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
  const out = new Array<number>(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k][1]] = r;
    i = j + 1;
  }
  return out;
}

export function spearman(x: Num[], y: Num[]): { r: number | null; n: number } {
  const [a, b] = pairs(x, y);
  if (a.length < 3) return { r: null, n: a.length };
  return pearson(ranks(a), ranks(b));
}

export type Method = "spearman" | "pearson";

/**
 * Correlação com defasagem: compara x no tempo t com y em t + k (k = 0…maxLag).
 * Ex.: x = temperatura semanal, y = casos; k = 4 → casos 4 semanas depois.
 */
export function laggedCorrelation(x: Num[], y: Num[], maxLag: number, method: Method = "spearman") {
  const f = method === "spearman" ? spearman : pearson;
  const out: { lag: number; r: number | null; n: number }[] = [];
  for (let k = 0; k <= maxLag; k++) {
    const res = f(x.slice(0, x.length - k), y.slice(k));
    out.push({ lag: k, ...res });
  }
  return out;
}

/**
 * Remove a sazonalidade média: valor − média do mesmo índice sazonal (ex.: semana epidemiológica)
 * em todos os anos. Exige ao menos `minYears` valores por índice; senão devolve null.
 */
export function seasonalAnomaly(values: Num[], seasonIndex: number[], minYears = 3): (number | null)[] {
  const sums = new Map<number, { s: number; n: number }>();
  values.forEach((v, i) => { if (!ok(v)) return; const k = seasonIndex[i]; const c = sums.get(k) || { s: 0, n: 0 }; c.s += v; c.n++; sums.set(k, c); });
  return values.map((v, i) => {
    const c = sums.get(seasonIndex[i]);
    return ok(v) && c && c.n >= minYears ? v - c.s / c.n : null;
  });
}

export const log1p = (v: Num) => (ok(v) && v >= 0 ? Math.log1p(v) : null);

/** Leitura qualitativa da magnitude de |r| — convenção descritiva, não teste de significância. */
export function strength(r: number | null) {
  if (r == null) return "indefinida";
  const a = Math.abs(r);
  return a < 0.1 ? "desprezível" : a < 0.3 ? "fraca" : a < 0.5 ? "moderada" : a < 0.7 ? "forte" : "muito forte";
}

/** Normalização min–max para índices exploratórios (0 = menor valor do conjunto, 1 = maior). */
export function minMax(values: Num[], invert = false): (number | null)[] {
  const v = values.filter(ok);
  if (v.length === 0) return values.map(() => null);
  const lo = Math.min(...v), hi = Math.max(...v);
  return values.map((x) => {
    if (!ok(x)) return null;
    const s = hi === lo ? 0.5 : (x - lo) / (hi - lo);
    return invert ? 1 - s : s;
  });
}
