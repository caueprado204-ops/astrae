import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOni, parseWeekly } from "../services/enso/oni";
import { parseCapabilities, resolveVariables } from "../services/nasa/gibs";
import { translateQuery } from "../services/search";
import { dailyAnomaly } from "../services/nasa/power";

// Trecho real do arquivo oficial https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt
const ONI = ` SEAS  YR   TOTAL   ANOM
  OND 2025  26.04  -0.61
  NDJ 2025  25.96  -0.60
  DJF 2026  26.15  -0.39
  JFM 2026  26.57  -0.21
  FMA 2026  27.34   0.11
  MAM 2026  28.09   0.46
  AMJ 2026  28.74   0.95
  MJJ 2026  29.02   1.39
  JJA 2026  29.09   1.80
  JAS 2026  29.12   2.16`;

test("ONI: parse e critério de 5 trimestres do CPC", () => {
  const rows = parseOni(ONI);
  assert.equal(rows.length, 10);
  assert.equal(rows[0].season, "OND");
  assert.equal(rows.at(-1)!.anomaly, 2.16);
  // OND 2025 e NDJ 2025 cruzam -0,5 mas são só 2 trimestres → não é episódio de La Niña
  assert.equal(rows[0].threshold, "La Niña");
  assert.equal(rows[0].episode, "Neutral");
  // AMJ..JAS 2026: apenas 4 trimestres ≥ +0,5 neste trecho → ainda não é episódio
  assert.equal(rows.at(-1)!.threshold, "El Niño");
  assert.equal(rows.at(-1)!.episode, "Neutral");
  const longer = parseOni(ONI + "\n  ASO 2026  29.20   2.30");
  assert.equal(longer.at(-1)!.episode, "El Niño");
  assert.equal(longer.at(-1)!.strength, "Muito forte");
  assert.equal(longer.at(-1)!.centerMonth, "2026-09");
});

test("Weekly Niño: valores colados com sinal negativo", () => {
  const txt = ` Week          Nino1+2      Nino3        Nino34        Nino4
             SST SSTA     SST SSTA     SST SSTA     SST SSTA
 03JAN1990     23.4-0.4     25.1-0.3     26.6 0.0     28.6 0.3`;
  const r = parseWeekly(txt);
  assert.deepEqual(r[0], { week: "1990-01-03", nino12: -0.4, nino3: -0.3, nino34: 0, nino4: 0.3 });
});

test("GIBS: parse do GetCapabilities e resolução de variáveis", () => {
  const xml = `<Contents><Layer><ows:Title xml:lang='en'>2-meter Air Temperature, (Monthly, MERRA2)</ows:Title>
  <ows:Identifier>MERRA2_2m_Air_Temperature_Monthly</ows:Identifier>
  <Style isDefault='true'><LegendURL xlink:href='https://gibs.earthdata.nasa.gov/legends/MERRA2_2m_Air_Temperature_Monthly_H.svg' /></Style>
  <Dimension><ows:Identifier>Time</ows:Identifier><Default>2026-07-01</Default><Value>2025-07-01/2026-07-01/P1M</Value></Dimension>
  <TileMatrixSetLink><TileMatrixSet>GoogleMapsCompatible_Level6</TileMatrixSet></TileMatrixSetLink><Format>image/png</Format></Layer></Contents>`;
  const m = parseCapabilities(xml);
  const l = m.get("MERRA2_2m_Air_Temperature_Monthly")!;
  assert.equal(l.maxZoom, 6);
  assert.equal(l.periodicity, "P1M");
  assert.equal(l.defaultTime, "2026-07-01");
  assert.ok(l.legendUrl?.endsWith("_H.svg"));
  const vars = resolveVariables(Object.fromEntries(m));
  assert.equal(vars.find((v) => v.key === "temperature")!.available, true);
  assert.equal(vars.find((v) => v.key === "sst")!.available, false);
});

test("Busca: tradução PT→EN para as APIs da NASA", () => {
  assert.equal(translateQuery("Marte temperatura atmosfera"), "mars temperature atmosphere");
  assert.equal(translateQuery("temperatura Pacífico 2026"), "temperature pacific 2026");
});

test("POWER: anomalia diária contra climatologia mensal", () => {
  const s = dailyAnomaly({ id: "x", label: "T", unit: "C", kind: "MODEL", points: [{ t: "2026-02-10", v: 25 }, { t: "2026-03-01", v: null }] },
    [20, 22, 21, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(s.points, [{ t: "2026-02-10", v: 3 }, { t: "2026-03-01", v: null }]);
});

import { sanitizeCitations } from "../services/ai/citations";

test("ASTRAE AI: remove citações a fontes não consultadas", () => {
  const r = sanitizeCitations("ONI em +2,16 °C [S1]. Chuva acima da média [S2, S9]. Artigo inventado [S7].", new Set(["S1", "S2"]));
  assert.equal(r.answer, "ONI em +2,16 °C [S1]. Chuva acima da média [S2]. Artigo inventado .");
  assert.deepEqual(r.removed, ["S9", "S7"]);
  assert.deepEqual([...r.cited], ["S1", "S2"]);
});
