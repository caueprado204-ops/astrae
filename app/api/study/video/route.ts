import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { getVideoLesson } from "@/services/study/video";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id || id.length > 200) return badRequest("id is required");
  const prov = { source: "NASA", institution: "NASA", dataset: "NASA Image and Video Library — vídeo e legendas", kind: "IMAGERY" as const,
    originalUrl: `https://images.nasa.gov/details/${encodeURIComponent(id)}`, apiEndpoint: "https://images-api.nasa.gov/asset/{nasa_id}", accessedAt: nowIso(),
    notes: "Transcrição = legenda oficial publicada junto ao vídeo, quando existe. Idioma original do vídeo (geralmente inglês)." };
  try {
    const c = await cached(`study:video:${id}`, 24 * 3600e3, () => getVideoLesson(id));
    return ok(c, prov, (v) => v.files.length === 0);
  } catch (e) { return fail(e, prov); }
}
