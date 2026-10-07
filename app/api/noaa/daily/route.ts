import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { CDO_DOCS, noaaConfigured, stationDaily } from "@/services/noaa/cdo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const station = sp.get("station") || "", start = sp.get("start") || "", end = sp.get("end") || "";
  if (!/^GHCND:[A-Z0-9]+$/.test(station)) return badRequest("station must be a GHCND id");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return badRequest("start/end YYYY-MM-DD");
  const prov = { source: "NOAA", institution: "NOAA NCEI", dataset: "GHCN-Daily", kind: "OBSERVED" as const,
    originalUrl: CDO_DOCS, accessedAt: nowIso(), location: station, period: `${start} → ${end}`, unit: "°C · mm" };
  if (!noaaConfigured()) return fail(new Error("NOAA_API_KEY não configurada"), prov, 503);
  try {
    const c = await cached(`noaa:daily:${station}:${start}:${end}`, 86400e3, async () => (await stationDaily(station, start, end)).body.results || []);
    return ok(c, prov);
  } catch (e) { return fail(e, prov); }
}
