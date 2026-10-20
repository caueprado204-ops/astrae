import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe as desc, laggedCorrelation, minMax, pearson, ranks, seasonalAnomaly, spearman, strength } from "../lib/stats";
import { aggregateToWeeks } from "../lib/epiweek";
import { parseInfoDengue } from "../services/health/infodengue";
import { areaAndCentroid, parseSidra, AGE_65_PLUS, type Feature } from "../services/ibge";
import { powerCell } from "../services/territory/indicators";

// Resposta real: https://info.dengue.mat.br/api/alertcity?geocode=3509502&disease=dengue&format=json&ew_start=1&ew_end=3&ey_start=2024&ey_end=2024
const infodengue = JSON.parse(readFileSync(new URL("./fixtures/infodengue-campinas-2024-w1-3.json", import.meta.url), "utf8"));

test("InfoDengue: ordena por semana, converte início da SE e campos numéricos", () => {
  const w = parseInfoDengue(infodengue);
  assert.deepEqual(w.map((x) => x.se), [202401, 202402, 202403]);
  assert.equal(w[0].weekStart, "2023-12-31"); // domingo que inicia a SE 1/2024
  assert.equal(w[2].weekStart, "2024-01-14");
  assert.equal(w[2].cases, 1186);
  assert.equal(w[2].probable, 929);
  assert.equal(w[0].population, 1170247);
  assert.equal(w[0].municipality, "Campinas");
});

// Resposta real: https://apisidra.ibge.gov.br/values/t/9514/n6/3509502/v/93/p/2022/c2/6794/c287/100362,93096,…/c286/113635
const header = { NC: "Nível Territorial (Código)", D1C: "Município (Código)", D2C: "Variável (Código)", V: "Valor" };
const row = (code: string, v: string) => ({ NC: "6", MN: "Pessoas", V: v, D1C: "3509502", D1N: "Campinas (SP)", D2C: "93", D2N: "População residente", D3N: "2022", D5C: code });
const sidraRaw = [header, row("100362", "1139047"), row("93096", "51258"), row("93097", "38469"), row("93098", "25459"), row("49108", "16822"), row("49109", "9381"), row("60040", "4119"), row("60041", "1172"), row("6653", "169")];

test("SIDRA: descarta o cabeçalho e calcula a proporção de 65+ (Campinas, Censo 2022)", () => {
  const rows = parseSidra(sidraRaw as never);
  assert.equal(rows.length, 9);
  const total = rows.find((r) => r.D5C === "100362")!.value!;
  const old = rows.filter((r) => AGE_65_PLUS.includes(r.D5C)).reduce((s, r) => s + r.value!, 0);
  assert.equal(old, 146849);
  assert.equal(Math.round((old / total) * 1000) / 10, 12.9);
  assert.equal(parseSidra([header, { ...row("1", "...") }] as never)[0].value, null); // "..." = sem dado
});

test("estatística: descritivas, Pearson, Spearman com empates", () => {
  const d = desc([1, 2, 3, 4, null, 100]);
  assert.equal(d.n, 5); assert.equal(d.missing, 1); assert.equal(d.median, 3);
  assert.equal(pearson([1, 2, 3, 4], [2, 4, 6, 8]).r, 1);
  assert.deepEqual(ranks([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
  assert.equal(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 25]).r, 1); // monotônica não linear
  assert.equal(spearman([1, 2], [1, 2]).r, null); // n < 3
  assert.equal(strength(-0.45), "moderada");
});

test("correlação com defasagem encontra o atraso de 2 passos", () => {
  const x = [0, 1, 0, 0, 5, 0, 0, 2, 0, 0, 7, 0, 1, 0, 3];
  const y = [0, 0, ...x.slice(0, -2)];
  const res = laggedCorrelation(x, y, 4, "pearson");
  const best = res.reduce((a, b) => ((b.r ?? -2) > (a.r ?? -2) ? b : a));
  assert.equal(best.lag, 2);
  assert.ok(Math.abs(best.r! - 1) < 1e-9);
  assert.equal(res[2].n, x.length - 2);
});

test("sazonalidade removida por semana do ano; exige anos mínimos", () => {
  const v = [10, 20, 12, 22, 14, 24], idx = [1, 2, 1, 2, 1, 2];
  assert.deepEqual(seasonalAnomaly(v, idx, 3), [-2, -2, 0, 0, 2, 2]);
  assert.deepEqual(seasonalAnomaly(v, idx, 4), [null, null, null, null, null, null]);
});

test("agregação semanal: média, soma extrapolada e semana incompleta", () => {
  const daily = new Map<string, number | null>();
  for (let i = 0; i < 7; i++) daily.set(`2024-01-${String(i + 7).padStart(2, "0")}`, i + 1); // 7..13 jan
  daily.set("2024-01-14", 5);
  const [a, b] = aggregateToWeeks(["2024-01-07", "2024-01-14"], daily, "mean");
  assert.equal(a.value, 4); assert.equal(a.days, 7);
  assert.equal(b.value, null); assert.equal(b.days, 1);
  daily.delete("2024-01-13");
  const [s] = aggregateToWeeks(["2024-01-07"], daily, "sum");
  assert.equal(s.days, 6); assert.equal(s.value, (21 * 7) / 6);
});

test("malha: área e centróide de um quadrado de 1° no equador", () => {
  const f: Feature = { type: "Feature", properties: { codarea: "x" }, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } };
  const g = areaAndCentroid(f);
  assert.ok(Math.abs(g.lon - 0.5) < 1e-9 && Math.abs(g.lat - 0.5) < 1e-9);
  assert.ok(g.areaKm2 > 12300 && g.areaKm2 < 12400); // ~111,2 km × 111,2 km
});

test("índice exploratório: min–max com inversão e célula POWER compartilhada", () => {
  assert.deepEqual(minMax([10, 20, null, 30]), [0, 0.5, null, 1]);
  assert.deepEqual(minMax([10, 30], true), [1, 0]);
  assert.equal(powerCell(-22.9, -47.06), powerCell(-22.8, -47.2));
});
