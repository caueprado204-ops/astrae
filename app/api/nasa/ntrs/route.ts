import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { searchNtrs } from "@/services/nasa/ntrs";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return badRequest("q is required");
  const prov = { source: "NASA", institution: "NASA STI Program", dataset: "NTRS citations", kind: "CATALOG" as const,
    originalUrl: "https://ntrs.nasa.gov", apiEndpoint: "https://ntrs.nasa.gov/api/citations/search", accessedAt: nowIso() };
  try {
    const c = await cached(`ntrs:${q}`, 6 * 3600e3, () => searchNtrs(q, 20));
    return ok(c, prov, (v) => v.items.length === 0);
  } catch (e) { return fail(e, prov); }
}
