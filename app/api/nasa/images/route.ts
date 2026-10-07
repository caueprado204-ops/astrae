import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { searchNasaMedia } from "@/services/nasa/images";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  if (!q) return badRequest("q is required");
  const mediaType = sp.get("media_type") === "video" ? "video" : "image";
  const page = Math.max(1, Number(sp.get("page") || 1));
  const prov = { source: "NASA", institution: "NASA", dataset: "NASA Image and Video Library", kind: "IMAGERY" as const,
    originalUrl: "https://images.nasa.gov", apiEndpoint: "https://images-api.nasa.gov/search", accessedAt: nowIso() };
  try {
    const c = await cached(`images:${mediaType}:${q}:${page}`, 6 * 3600e3, () => searchNasaMedia(q, { mediaType, page }));
    return ok(c, prov, (v) => v.items.length === 0);
  } catch (e) { return fail(e, prov); }
}
