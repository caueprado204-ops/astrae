import { cached } from "@/lib/cache";
import { badRequest, fail, nowIso, ok } from "@/lib/envelope";
import { getRoverImages, getRoverPosition, ROVERS, type RoverId } from "@/services/mars/rovers";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { rover: string } }) {
  const rover = params.rover.toLowerCase() as RoverId;
  if (!(rover in ROVERS)) return badRequest("unknown rover");
  const solParam = new URL(req.url).searchParams.get("sol");
  const sol = solParam ? Number(solParam) : undefined;
  if (sol !== undefined && (!Number.isInteger(sol) || sol < 0)) return badRequest("invalid sol");
  const meta = ROVERS[rover];
  const archived = meta.status === "complete";
  const prov = {
    source: "NASA", institution: "NASA/JPL-Caltech", dataset: archived ? "NASA Image and Video Library (acervo da missão)" : `${meta.name} raw images`,
    kind: "IMAGERY" as const, originalUrl: meta.url, accessedAt: nowIso(),
    notes: archived ? "Missão encerrada. A Mars Rover Photos API foi arquivada pela NASA; imagens via NASA Image Library." : "Imagens brutas (não calibradas) publicadas pela equipe da missão."
  };
  try {
    const c = await cached(`rover:${rover}:${sol ?? "latest"}`, 2 * 3600e3, async () => {
      const [imgs, pos] = await Promise.allSettled([getRoverImages(rover, sol), getRoverPosition(rover)]);
      if (imgs.status === "rejected" && (pos.status === "rejected" || !pos.value)) throw imgs.reason;
      return {
        meta,
        images: imgs.status === "fulfilled" ? imgs.value.images : [],
        imagesEndpoint: imgs.status === "fulfilled" ? imgs.value.url : undefined,
        imagesError: imgs.status === "rejected" ? String((imgs.reason as Error)?.message) : undefined,
        position: pos.status === "fulfilled" ? pos.value : null
      };
    });
    return ok(c, { ...prov, apiEndpoint: c.value.imagesEndpoint }, () => false);
  } catch (e) { return fail(e, prov); }
}
