import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { CDO_DOCS, findStations, noaaConfigured } from "@/services/noaa/cdo";

export const dynamic = "force-dynamic";

/** ?extent=minLat,minLon,maxLat,maxLon */
export async function GET(req: Request) {
  const ext = (new URL(req.url).searchParams.get("extent") || "").split(",").map(Number);
  if (ext.length !== 4 || ext.some((n) => !isFinite(n))) return badRequest("extent=minLat,minLon,maxLat,maxLon");
  const prov = { source: "NOAA", institution: "NOAA NCEI", dataset: "GHCN-Daily stations", kind: "CATALOG" as const, originalUrl: CDO_DOCS, accessedAt: nowIso() };
  if (!noaaConfigured()) return fail(new Error("NOAA_API_KEY não configurada"), prov, 503);
  try {
    const c = await cached(`noaa:stations:${ext.join(",")}`, 86400e3, async () => (await findStations(ext as [number, number, number, number])).body.results || []);
    return ok(c, prov);
  } catch (e) { return fail(e, prov); }
}
