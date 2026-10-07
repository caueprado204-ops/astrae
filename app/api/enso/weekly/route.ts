import { cached } from "@/lib/cache";
import { fail, nowIso, ok } from "@/lib/envelope";
import { getWeekly, WEEKLY_URL } from "@/services/enso/oni";

export const dynamic = "force-dynamic";

export async function GET() {
  const prov = {
    source: "NOAA", institution: "NOAA Climate Prediction Center", dataset: "Weekly OISST v2.1 Niño-region anomalies (base 1991–2020)",
    kind: "OBSERVED" as const, originalUrl: "https://www.cpc.ncep.noaa.gov/data/indices/", apiEndpoint: WEEKLY_URL,
    accessedAt: nowIso(), unit: "°C (anomalia)", location: "Niño 1+2, 3, 3.4, 4",
    methodology: "Análise OISST v2.1 (satélite + in situ, interpolação ótima), média semanal centrada na quarta-feira."
  };
  try {
    const c = await cached("enso:weekly", 6 * 3600e3, getWeekly);
    return ok(c, prov);
  } catch (e) { return fail(e, prov); }
}
