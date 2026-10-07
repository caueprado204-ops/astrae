import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { dailyAnomaly, getPowerClimatology, getPowerDaily, isPowerParam, type PowerParam } from "@/services/nasa/power";

export const dynamic = "force-dynamic";

/**
 * GET /api/nasa/power?lat=-23.55&lon=-46.63&start=2026-01-01&end=2026-09-30&params=T2M,PRECTOTCORR&anomaly=1
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat")), lon = Number(sp.get("lon"));
  const start = sp.get("start") || "", end = sp.get("end") || "";
  const params = (sp.get("params") || "T2M").split(",").filter(isPowerParam) as PowerParam[];
  const withAnomaly = sp.get("anomaly") === "1";
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return badRequest("invalid lat/lon");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return badRequest("start/end must be YYYY-MM-DD");
  if (params.length === 0) return badRequest("no valid params");
  const days = (Date.parse(end) - Date.parse(start)) / 86400e3;
  if (days < 0 || days > 366 * 5) return badRequest("period must be between 0 and 5 years");
  if (Date.parse(start) < Date.parse("1981-01-01")) return badRequest("POWER daily data starts in 1981");

  const prov = {
    source: "NASA", institution: "NASA Langley Research Center", dataset: "POWER Daily (MERRA-2 / GEOS FP-IT / CERES)",
    kind: "MODEL" as const, originalUrl: "https://power.larc.nasa.gov/", apiEndpoint: "https://power.larc.nasa.gov/api/temporal/daily/point",
    accessedAt: nowIso(), location: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, period: `${start} → ${end}`,
    methodology: "Reanálise atmosférica em grade ~0,5°×0,625°; não é medição de estação. Anomalia = diário − climatologia mensal POWER do ponto."
  };
  try {
    const key = `power:${lat.toFixed(3)}:${lon.toFixed(3)}:${start}:${end}:${params.join(",")}:${withAnomaly}`;
    const c = await cached(key, 12 * 3600e3, async () => {
      const daily = await getPowerDaily(lat, lon, params, start, end);
      if (!withAnomaly) return { ...daily, anomalies: [], climatologyPeriod: undefined as string | undefined };
      const clim = await getPowerClimatology(lat, lon, params);
      const anomalies = daily.series.map((s, i) => dailyAnomaly(s, clim.climatology[params[i]].monthly));
      return { ...daily, anomalies, climatologyPeriod: clim.period };
    });
    return ok(c, prov, (v) => v.series.every((s) => s.points.length === 0));
  } catch (e) { return fail(e, prov); }
}
