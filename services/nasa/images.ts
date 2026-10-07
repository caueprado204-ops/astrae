import "server-only";
import { fetchJson } from "@/lib/http";

/** NASA Image and Video Library — https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf (sem chave) */
export interface NasaMediaItem {
  nasaId: string; title: string; description: string; center?: string;
  dateCreated?: string; mediaType: string; keywords: string[];
  thumb?: string; detailsUrl: string; assetManifest: string; photographer?: string;
}

interface RawResp {
  collection: {
    items: { href: string; data: { nasa_id: string; title: string; description?: string; center?: string; date_created?: string; media_type: string; keywords?: string[]; photographer?: string; secondary_creator?: string }[]; links?: { href: string; rel: string; render?: string }[] }[];
    metadata?: { total_hits: number };
  };
}

export async function searchNasaMedia(q: string, opts: { mediaType?: "image" | "video"; page?: number; pageSize?: number; yearStart?: string } = {}) {
  const params = new URLSearchParams({ q, page: String(opts.page ?? 1), page_size: String(opts.pageSize ?? 24) });
  if (opts.mediaType) params.set("media_type", opts.mediaType);
  if (opts.yearStart) params.set("year_start", opts.yearStart);
  const url = `https://images-api.nasa.gov/search?${params}`;
  const raw = await fetchJson<RawResp>(url);
  const items: NasaMediaItem[] = raw.collection.items.map((it) => {
    const d = it.data[0];
    const thumb = it.links?.find((l) => l.rel === "preview")?.href;
    return {
      nasaId: d.nasa_id,
      title: d.title,
      description: (d.description || "").slice(0, 600),
      center: d.center,
      dateCreated: d.date_created,
      mediaType: d.media_type,
      keywords: d.keywords || [],
      thumb,
      detailsUrl: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
      assetManifest: it.href,
      photographer: d.photographer || d.secondary_creator
    };
  });
  return { items, total: raw.collection.metadata?.total_hits ?? items.length, url };
}

/** Converte miniatura "~thumb" em versão maior quando disponível no mesmo padrão de nomes. */
export const largerImage = (thumb?: string) => thumb?.replace("~thumb.", "~medium.");
