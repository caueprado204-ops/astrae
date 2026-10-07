import { cached } from "@/lib/cache";
import { fail, nowIso, ok } from "@/lib/envelope";
import { ENSO_DISC_URL, getOfficialStatus } from "@/services/enso/oni";

export const dynamic = "force-dynamic";

export async function GET() {
  const prov = { source: "NOAA", institution: "NOAA Climate Prediction Center / IRI", dataset: "ENSO Diagnostic Discussion",
    kind: "FORECAST" as const, originalUrl: ENSO_DISC_URL, apiEndpoint: ENSO_DISC_URL, accessedAt: nowIso(),
    notes: "Status oficial do ENSO Alert System — texto extraído da discussão mensal publicada pelo CPC." };
  try {
    const c = await cached("enso:status", 6 * 3600e3, getOfficialStatus);
    return ok(c, prov);
  } catch (e) { return fail(e, prov); }
}
