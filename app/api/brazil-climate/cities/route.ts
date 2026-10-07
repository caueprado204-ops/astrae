import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { CPTEC_DOCS, searchCities } from "@/services/inpe/cptec";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return badRequest("q must have at least 2 characters");
  const prov = { source: "INPE", institution: "CPTEC/INPE", dataset: "Lista de localidades", kind: "CATALOG" as const,
    originalUrl: CPTEC_DOCS, accessedAt: nowIso() };
  try {
    const c = await cached(`cptec:cities:${q.toLowerCase()}`, 7 * 86400e3, () => searchCities(q));
    return ok(c, prov);
  } catch (e) { return fail(e, prov); }
}
