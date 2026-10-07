import "server-only";
import { fetchJson } from "@/lib/http";

/** NASA Technical Reports Server — https://ntrs.nasa.gov/api/openapi/ */
export interface NtrsCitation {
  id: number; title: string; abstract: string; stiType?: string; authors: string[];
  center?: string; published?: string; subjects: string[]; pdfUrl?: string; url: string;
}

interface Raw {
  stats: { total: number };
  results: {
    id: number; title: string; abstract?: string; stiTypeDetails?: string; subjectCategories?: string[];
    authorAffiliations?: { meta: { author: { name: string } } }[];
    center?: { name: string }; publications?: { publicationDate?: string }[]; distributionDate?: string;
    downloads?: { links?: { pdf?: string } }[];
  }[];
}

export async function searchNtrs(q: string, size = 15) {
  const url = `https://ntrs.nasa.gov/api/citations/search?${new URLSearchParams({ q, "page.size": String(size) })}`;
  const raw = await fetchJson<Raw>(url);
  const items: NtrsCitation[] = raw.results.map((r) => ({
    id: r.id,
    title: r.title,
    abstract: (r.abstract || "").slice(0, 700),
    stiType: r.stiTypeDetails,
    authors: (r.authorAffiliations || []).map((a) => a.meta.author.name).slice(0, 6),
    center: r.center?.name,
    published: r.publications?.[0]?.publicationDate || r.distributionDate,
    subjects: r.subjectCategories || [],
    pdfUrl: r.downloads?.[0]?.links?.pdf ? `https://ntrs.nasa.gov${r.downloads[0].links.pdf}` : undefined,
    url: `https://ntrs.nasa.gov/citations/${r.id}`
  }));
  return { items, total: raw.stats.total, url };
}
