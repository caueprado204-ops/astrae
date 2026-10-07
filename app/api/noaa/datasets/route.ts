import { cached } from "@/lib/cache";
import { fail, nowIso, ok } from "@/lib/envelope";
import { CDO_DOCS, listDatasets, noaaConfigured } from "@/services/noaa/cdo";

export const dynamic = "force-dynamic";

export async function GET() {
  const prov = { source: "NOAA", institution: "NOAA NCEI", dataset: "Climate Data Online — datasets", kind: "CATALOG" as const,
    originalUrl: CDO_DOCS, accessedAt: nowIso() };
  if (!noaaConfigured()) return fail(new Error("NOAA_API_KEY não configurada — adicione o token no .env.local"), prov, 503);
  try {
    const c = await cached("noaa:datasets", 86400e3, async () => (await listDatasets()).body.results || []);
    return ok(c, prov);
  } catch (e) { return fail(e, prov); }
}
