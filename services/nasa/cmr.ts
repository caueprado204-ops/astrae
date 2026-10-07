import "server-only";
import { fetchJson } from "@/lib/http";

/** NASA Earthdata Common Metadata Repository — https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html */
export interface CmrCollection {
  id: string; shortName: string; title: string; summary: string; dataCenter: string;
  organizations: string[]; timeStart?: string; timeEnd?: string; version?: string;
  platforms: string[]; processingLevel?: string; cloudHosted?: boolean;
  earthdataSearchUrl: string; thumbnail?: string; updated?: string;
}

interface RawEntry {
  id: string; short_name: string; title: string; summary?: string; data_center: string; organizations?: string[];
  time_start?: string; time_end?: string; version_id?: string; platforms?: string[]; processing_level_id?: string;
  cloud_hosted?: boolean; updated?: string; links?: { rel: string; href: string }[];
}

export async function searchCollections(keyword: string, pageSize = 20) {
  const params = new URLSearchParams({ keyword, page_size: String(pageSize), sort_key: "-usage_score" });
  const url = `https://cmr.earthdata.nasa.gov/search/collections.json?${params}`;
  const raw = await fetchJson<{ feed: { entry: RawEntry[] } }>(url);
  const items: CmrCollection[] = (raw.feed.entry || []).map((e) => ({
    id: e.id,
    shortName: e.short_name,
    title: e.title,
    summary: (e.summary || "").slice(0, 700),
    dataCenter: e.data_center,
    organizations: e.organizations || [],
    timeStart: e.time_start,
    timeEnd: e.time_end,
    version: e.version_id,
    platforms: e.platforms || [],
    processingLevel: e.processing_level_id,
    cloudHosted: e.cloud_hosted,
    updated: e.updated,
    earthdataSearchUrl: `https://search.earthdata.nasa.gov/search/granules?p=${encodeURIComponent(e.id)}`,
    thumbnail: e.links?.find((l) => l.rel.endsWith("/browse#") && /\.(png|jpe?g|gif)$/i.test(l.href))?.href
  }));
  return { items, url };
}
