import "server-only";
import { cached } from "@/lib/cache";
import { AGE_65_PLUS, AGE_TOTAL, areaAndCentroid, featureCode, sidra, stateMunicipalMesh, type Feature } from "@/services/ibge";
import { getPowerClimatology } from "@/services/nasa/power";
import { getArboWeeks } from "@/services/health/infodengue";
import type { DataKind } from "@/types/science";

/**
 * Eixo B — indicadores por município, cada um com fonte, ano e tipo declarados.
 * Nenhum indicador isolado define "vulnerabilidade": o índice exploratório é montado pelo usuário,
 * com pesos visíveis, na interface.
 */
export interface IndicatorDef { id: string; label: string; unit: string; group: "clima" | "social" | "saude"; kind: DataKind; source: string; year: string; note: string; higherIsWorse: boolean }

export const INDICATORS: IndicatorDef[] = [
  { id: "tmax_clim", label: "Temperatura máxima média anual", unit: "°C", group: "clima", kind: "MODEL", source: "NASA POWER — climatologia (MERRA-2)", year: "climatologia POWER", higherIsWorse: true,
    note: "Média anual de T2M_MAX no centróide do município. Grade ~0,5°×0,625°: municípios vizinhos costumam cair na mesma célula." },
  { id: "prec_clim", label: "Precipitação média anual", unit: "mm/dia", group: "clima", kind: "MODEL", source: "NASA POWER — climatologia (MERRA-2)", year: "climatologia POWER", higherIsWorse: false,
    note: "PRECTOTCORR anual; mesma limitação de resolução. Mais chuva não é, por si, melhor ou pior — ajuste a direção conforme a pergunta." },
  { id: "pop", label: "População residente", unit: "pessoas", group: "social", kind: "OBSERVED", source: "IBGE — Censo 2022 (tabela 4714)", year: "2022", higherIsWorse: true, note: "Contagem censitária." },
  { id: "density", label: "Densidade demográfica", unit: "hab/km²", group: "social", kind: "OBSERVED", source: "IBGE — Censo 2022 (tabela 4714)", year: "2022", higherIsWorse: true, note: "Publicada pelo IBGE." },
  { id: "elderly", label: "População com 65 anos ou mais", unit: "%", group: "social", kind: "ESTIMATE", source: "IBGE — Censo 2022 (tabela 9514)", year: "2022", higherIsWorse: true,
    note: "Calculado pela ASTRAE: soma das faixas de 65 anos ou mais ÷ população total." },
  { id: "gdp_pc", label: "PIB per capita", unit: "R$", group: "social", kind: "ESTIMATE", source: "IBGE — PIB dos Municípios (5938) ÷ Censo 2022 (4714)", year: "2022", higherIsWorse: false,
    note: "Calculado pela ASTRAE: PIB a preços correntes de 2022 ÷ população do Censo 2022. PIB per capita não mede distribuição de renda." },
  { id: "dengue_inc", label: "Incidência de dengue (últimas 52 semanas)", unit: "casos/100 mil", group: "saude", kind: "ESTIMATE", source: "InfoDengue (Fiocruz/FGV) + população IBGE", year: "52 semanas mais recentes", higherIsWorse: true,
    note: "Soma dos casos notificados nas 52 semanas mais recentes ÷ população informada pelo InfoDengue × 100 mil. Casos recentes ainda são revisados." }
];

export interface MunicipalityIndicators { id: string; name: string; lat: number | null; lon: number | null; areaKm2: number | null; powerCell: string | null; values: Record<string, number | null>; errors: string[] }

/** Célula da grade meteorológica do POWER (0,5° lat × 0,625° lon) — para avisar quando municípios compartilham o mesmo valor. */
export const powerCell = (lat: number, lon: number) => `${Math.floor((lat + 90) / 0.5)}:${Math.floor((lon + 180) / 0.625)}`;

export async function getTerritoryIndicators(ids: string[]) {
  const ufCodes = Array.from(new Set(ids.map((id) => id.slice(0, 2))));
  const urls: string[] = [];

  // geometria e centróides
  const meshes = await Promise.all(ufCodes.map((uf) => cached(`ibge:mesh:${uf}`, 30 * 86400e3, () => stateMunicipalMesh(uf))));
  const features = new Map<string, Feature>();
  meshes.forEach((m) => { urls.push(m.value.url); m.value.fc.features.forEach((f) => features.set(featureCode(f), f)); });

  const list = ids.join(",");
  const [census, ages, gdp] = await Promise.all([
    cached(`sidra:4714:${list}`, 30 * 86400e3, () => sidra(`/t/4714/n6/${list}/v/93,614/p/2022`)),
    cached(`sidra:9514:${list}`, 30 * 86400e3, () => sidra(`/t/9514/n6/${list}/v/93/p/2022/c2/6794/c287/${[AGE_TOTAL, ...AGE_65_PLUS].join(",")}/c286/113635`)),
    cached(`sidra:5938:${list}`, 30 * 86400e3, () => sidra(`/t/5938/n6/${list}/v/37/p/2022`)).catch(() => null)
  ]);
  urls.push(census.value.url, ages.value.url);
  if (gdp) urls.push(gdp.value.url);

  const year = new Date().getUTCFullYear();
  const out: MunicipalityIndicators[] = await Promise.all(ids.map(async (id) => {
    const errors: string[] = [];
    const f = features.get(id);
    const geo = f ? areaAndCentroid(f) : null;
    const lat = geo && Number.isFinite(geo.lat) ? geo.lat : null, lon = geo && Number.isFinite(geo.lon) ? geo.lon : null;
    const v: Record<string, number | null> = Object.fromEntries(INDICATORS.map((i) => [i.id, null]));

    const c = census.value.rows.filter((r) => r.D1C === id);
    v.pop = c.find((r) => r.D2C === "93")?.value ?? null;
    v.density = c.find((r) => r.D2C === "614")?.value ?? null;
    const a = ages.value.rows.filter((r) => r.D1C === id);
    const total = a.find((r) => Object.values(r).includes(AGE_TOTAL))?.value ?? null;
    const old = a.filter((r) => AGE_65_PLUS.some((code) => Object.values(r).includes(code))).reduce((s, r) => s + (r.value ?? 0), 0);
    v.elderly = total ? (old / total) * 100 : null;
    const g = gdp?.value.rows.find((r) => r.D1C === id)?.value ?? null; // mil reais
    v.gdp_pc = g != null && v.pop ? (g * 1000) / v.pop : null;
    if (!gdp) errors.push("PIB indisponível na SIDRA agora");

    if (lat != null && lon != null) {
      try {
        const clim = await cached(`power:clim:${lat.toFixed(2)}:${lon.toFixed(2)}`, 30 * 86400e3, () => getPowerClimatology(lat, lon, ["T2M_MAX", "PRECTOTCORR"]));
        v.tmax_clim = clim.value.climatology.T2M_MAX?.annual ?? null;
        v.prec_clim = clim.value.climatology.PRECTOTCORR?.annual ?? null;
      } catch (e) { errors.push(`NASA POWER: ${(e as Error).message}`); }
    } else errors.push("Geometria do município não encontrada na malha do IBGE");

    try {
      const arbo = await cached(`infodengue:${id}:dengue:${year - 1}-${year}`, 12 * 3600e3, () => getArboWeeks(id, "dengue", year - 1, year));
      const last = arbo.value.weeks.slice(-52);
      const cases = last.reduce((s, w) => s + (w.cases ?? 0), 0);
      const pop = last.at(-1)?.population ?? null;
      v.dengue_inc = last.length >= 40 && pop ? (cases / pop) * 1e5 : null;
      if (last.length < 40) errors.push("InfoDengue: menos de 40 semanas disponíveis");
    } catch (e) { errors.push(`InfoDengue: ${(e as Error).message}`); }

    const name = c[0]?.D1N || a[0]?.D1N || id;
    return { id, name, lat, lon, areaKm2: geo?.areaKm2 ?? null, powerCell: lat != null && lon != null ? powerCell(lat, lon) : null, values: v, errors };
  }));

  const geojson = { type: "FeatureCollection" as const, features: ids.map((id) => features.get(id)).filter(Boolean) as Feature[] };
  return { municipalities: out, geojson, urls };
}
