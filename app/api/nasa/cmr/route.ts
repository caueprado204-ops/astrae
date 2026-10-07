import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { searchCollections } from "@/services/nasa/cmr";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return badRequest("q is required");
  const prov = { source: "NASA", institution: "NASA Earthdata (ESDIS)", dataset: "CMR collections", kind: "CATALOG" as const,
    originalUrl: "https://search.earthdata.nasa.gov", apiEndpoint: "https://cmr.earthdata.nasa.gov/search/collections.json", accessedAt: nowIso() };
  try {
    const c = await cached(`cmr:${q}`, 6 * 3600e3, () => searchCollections(q, 25));
    return ok(c, prov, (v) => v.items.length === 0);
  } catch (e) { return fail(e, prov); }
}
