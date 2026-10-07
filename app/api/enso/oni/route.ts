import { cached } from "@/lib/cache";
import { fail, nowIso, ok } from "@/lib/envelope";
import { getOni, ONI_URL } from "@/services/enso/oni";

export const dynamic = "force-dynamic";

export async function GET() {
  const prov = {
    source: "NOAA", institution: "NOAA Climate Prediction Center", dataset: "Oceanic Niño Index (ONI, ERSST.v5)",
    kind: "INDEX" as const, originalUrl: "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php",
    apiEndpoint: ONI_URL, accessedAt: nowIso(), unit: "°C", location: "Niño 3.4 (5°N–5°S, 170°W–120°W)",
    methodology: "Média móvel de 3 meses da anomalia de TSM (ERSST.v5) com climatologias de 30 anos centradas e atualizadas a cada 5 anos. Episódio: ≥5 trimestres consecutivos com ONI ≥ +0,5 °C (El Niño) ou ≤ −0,5 °C (La Niña). Intensidade (fraco/moderado/forte/muito forte) segue a convenção usual de faixas de 0,5 °C — não é classificação oficial do CPC."
  };
  try {
    const c = await cached("enso:oni", 6 * 3600e3, getOni);
    const v = c.value;
    return ok(c, { ...prov, period: `${v[0].season} ${v[0].year} → ${v[v.length - 1].season} ${v[v.length - 1].year}` });
  } catch (e) { return fail(e, prov); }
}
