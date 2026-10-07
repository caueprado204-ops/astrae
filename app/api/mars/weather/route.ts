import { cached } from "@/lib/cache";
import { fail, nowIso, ok } from "@/lib/envelope";
import { getMslWeather, MSL_WEATHER_URL, REMS_PDS_URL } from "@/services/mars/weather";

export const dynamic = "force-dynamic";

export async function GET() {
  const prov = {
    source: "NASA", institution: "NASA/JPL-Caltech · Centro de Astrobiología (CAB/INTA-CSIC)",
    dataset: "Curiosity REMS — resumo diário por sol", kind: "OBSERVED" as const,
    originalUrl: "https://mars.nasa.gov/msl/weather/", apiEndpoint: MSL_WEATHER_URL, accessedAt: nowIso(),
    location: "Cratera Gale, Marte (~4,6°S, 137,4°E)", unit: "°C · Pa",
    methodology: "Valores mín./máx. por sol medidos pela estação REMS a bordo do rover; influenciados pela posição e sombra do rover.",
    notes: `Feed de divulgação. Dados científicos completos no PDS: ${REMS_PDS_URL}`
  };
  try {
    const c = await cached("mars:msl:weather", 3 * 3600e3, getMslWeather);
    const s = c.value.sols;
    return ok(c, { ...prov, period: s.length ? `Sol ${s[0].sol} → Sol ${s[s.length - 1].sol} (${s[0].terrestrialDate} → ${s[s.length - 1].terrestrialDate})` : undefined },
      (v) => v.sols.length === 0);
  } catch (e) { return fail(e, prov); }
}
